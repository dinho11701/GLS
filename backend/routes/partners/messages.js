const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { db, admin } = require('../../config/firebase');
const authGuard = require('../../middleware/authGuard');

const router = express.Router();
const FieldValue = admin.firestore.FieldValue;

/* ---------- créer / récupérer une conv (partenaire init) ---------- */
router.post(
  '/conversations',
  authGuard,
  [
    body('customerId').isString().trim().notEmpty(),
    body('serviceId').optional().isString().trim(),
  ],
  async (req, res) => {
    const bad = validationResult(req);
    if (!bad.isEmpty()) return res.status(422).json({ errors: bad.array({ onlyFirstError: true }) });

    const partnerUid = req.user.uid;
    const { customerId, serviceId } = req.body;

    const sid = serviceId ? String(serviceId) : 'general';
    const conversationId = `c_${customerId}__p_${partnerUid}__s_${sid}`;
    const convRef = db.collection('conversations').doc(conversationId);

    try {
      const now = FieldValue.serverTimestamp();
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(convRef);
        if (!snap.exists) {
          tx.set(convRef, {
            participantKeys: [`customer:${customerId}`, `partner:${partnerUid}`],
            customerId,
            partnerUid,
            serviceId: serviceId || null,
            createdAt: now,
            updatedAt: now,
            lastMessage: null,
            unread: { customer: 0, partner: 0 },
            reads: { customer: null, partner: null },
            typing: { customer: false, partner: false },
          });
        }
      });
      const doc = await convRef.get();
      return res.json({ conversation: { id: doc.id, ...doc.data() } });
    } catch (e) {
      console.error('[P-MESSAGES][CONV][ERROR]', e);
      return res.status(500).json({ error: 'Failed to create/fetch conversation' });
    }
  }
);

/* ----------------------- helpers ----------------------- */
function handleValidation(req, res) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).json({ errors: result.array({ onlyFirstError: true }) });
  }
}

// lit un doc et en déduit le "meilleur" displayName selon le type
async function getDocName(kind /* 'partner'|'customer'|'user' */, uid) {
  try {
    if (!uid) return null;
    const col =
      kind === 'partner' ? 'partners' :
      kind === 'customer' ? 'customers' : 'users';

    const snap = await db.collection(col).doc(uid).get();
    if (!snap.exists) return null;
    const u = snap.data() || {};

    // Priorités:
    // - partner: nomOwner en premier
    // - customer: user en premier
    // - sinon: displayName, fullName, name, firstName+lastName
    let preferred = null;
    if (kind === 'partner') preferred = u.nomOwner;
    if (kind === 'customer') preferred = u.user;

    const n =
      preferred ||
      u.displayName ||
      u.fullName ||
      u.name ||
      [u.firstName, u.lastName].filter(Boolean).join(' ');

    return (n && String(n).trim()) || null;
  } catch {
    return null;
  }
}

async function getAuthName(uid) {
  try {
    if (!uid) return null;
    const user = await admin.auth().getUser(uid);
    const dn = user.displayName || (user.email ? user.email.split('@')[0] : null);
    return dn ? String(dn).trim() : null;
  } catch {
    return null;
  }
}

async function resolveDisplayName(kind /* 'partner' | 'customer' */, uid) {
  // 1) collection dédiée (avec priorité nomOwner/user)
  const c1 = await getDocName(kind, uid);
  if (c1) return c1;

  // 2) collection users générique (au cas où)
  const c2 = await getDocName('user', uid);
  if (c2) return c2;

  // 3) Firebase Auth
  const c3 = await getAuthName(uid);
  if (c3) return c3;

  return null;
}

// complète partnerName/customerName si manquants et écrit en base en arrière-plan
async function hydrateNames(conversations) {
  await Promise.all(
    conversations.map(async (c) => {
      try {
        const updates = {};
        if (!c.partnerName && c.partnerUid) {
          const n = await resolveDisplayName('partner', c.partnerUid);
          if (n) { c.partnerName = n; updates.partnerName = n; }
        }
        if (!c.customerName && c.customerId) {
          const n = await resolveDisplayName('customer', c.customerId);
          if (n) { c.customerName = n; updates.customerName = n; }
        }
        if (Object.keys(updates).length) {
          db.collection('conversations').doc(c.id).update(updates).catch(() => {});
        }
      } catch {}
    })
  );
  return conversations;
}

/** Lister les conversations d’un partenaire (tri par récence) */
router.get(
  '/conversations',
  authGuard,
  [
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('cursor').optional().isISO8601().toDate(),
  ],
  async (req, res) => {
    const bad = handleValidation(req, res); if (bad) return bad;

    const partnerUid = req.user.uid;
    const limit = parseInt(req.query.limit || '12', 10);

    try {
      let q = db.collection('conversations')
        .where('participantKeys', 'array-contains', `partner:${partnerUid}`)
        .orderBy('updatedAt', 'desc')
        .limit(limit);

      if (req.query.cursor) {
        const cursorDate = req.query.cursor;
        const cursorQ = await db.collection('conversations')
          .where('participantKeys', 'array-contains', `partner:${partnerUid}`)
          .orderBy('updatedAt', 'desc')
          .startAt(cursorDate)
          .limit(1).get();
        if (!cursorQ.empty) q = q.startAfter(cursorQ.docs[0]);
      }

      const snaps = await q.get();
      let conversations = snaps.docs.map(d => ({ id: d.id, ...d.data() }));
      conversations = await hydrateNames(conversations);

      const nextCursor = conversations.length
        ? conversations[conversations.length - 1].updatedAt?.toDate?.()?.toISOString?.() || null
        : null;

      return res.json({ conversations, nextCursor });

    } catch (err) {
      const msg = String(err.details || err.message || '');
      const needsIndex = msg.includes('The query requires an index');
      const building   = msg.includes('index is currently building');

      if (needsIndex || building) {
        try {
          const snaps2 = await db.collection('conversations')
            .where('participantKeys', 'array-contains', `partner:${partnerUid}`)
            .limit(limit * 2)
            .get();

          let conversations = snaps2.docs.map(d => ({ id: d.id, ...d.data() }));
          conversations.sort((a, b) => {
            const ta = a.updatedAt?.toMillis?.() ?? a.updatedAt?.toDate?.()?.getTime?.() ?? 0;
            const tb = b.updatedAt?.toMillis?.() ?? b.updatedAt?.toDate?.()?.getTime?.() ?? 0;
            return tb - ta;
          });
          conversations = conversations.slice(0, limit);
          conversations = await hydrateNames(conversations);

          return res.status(200).json({
            conversations,
            nextCursor: null,
            note: building ? 'fallback_no_orderby_index_building' : 'fallback_no_orderby_index_missing'
          });
        } catch (e2) {
          console.error('[P-MESSAGES][CONV_LIST][FALLBACK][ERROR]', e2);
          return res.status(503).json({ error: 'Firestore index initializing; temporary fallback failed.' });
        }
      }

      console.error('[P-MESSAGES][CONV_LIST][ERROR]', err);
      return res.status(500).json({ error: 'Failed to list conversations' });
    }
  }
);

/** Envoyer un message dans une conversation */
router.post(
  '/conversations/:conversationId/messages',
  authGuard,
  [
    param('conversationId').isString().notEmpty(),
    body('text')
      .customSanitizer(v => (v == null ? '' : String(v))).trim()
      .notEmpty().withMessage('text is required')
      .isLength({ max: 4000 }),
  ],
  async (req, res) => {
    const bad = handleValidation(req, res); if (bad) return bad;

    const { conversationId } = req.params;
    const { text } = req.body;
    const partnerUid = req.user.uid;

    const convRef = db.collection('conversations').doc(conversationId);
    const msgRef = convRef.collection('messages').doc();

    try {
      let customerId = null;

      await db.runTransaction(async (tx) => {
        const convSnap = await tx.get(convRef);
        if (!convSnap.exists) throw new Error('Conversation not found');

        const conv = convSnap.data();
        if (conv.partnerUid !== partnerUid) throw new Error('Forbidden');

        customerId = conv.customerId; // ⭐ Nécessaire pour la notif

        const now = FieldValue.serverTimestamp();
        const msg = {
          text,
          senderId: partnerUid,
          senderRole: 'partner',
          createdAt: now,
          attachments: [],
          readBy: ['partner'],
        };

        tx.set(msgRef, msg);

        tx.update(convRef, {
          updatedAt: now,
          lastMessage: { text, at: now, senderId: partnerUid, senderRole: 'partner' },
          'unread.customer': FieldValue.increment(1),
        });
      });

      /*
      -----------------------------------------------------
      ⭐ AJOUT NOTIFICATION DANS customers/{customerId}/notifs
      -----------------------------------------------------
      */
      if (customerId) {
        const notifRef = db
          .collection("customers")
          .doc(customerId)
          .collection("notifs")
          .doc(); // auto ID

        await notifRef.set({
          type: "message",
          title: "Nouveau message",
          body: text.length > 60 ? text.slice(0, 60) + "…" : text,
          data: { conversationId },
          status: "unread",
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          readAt: null,
        });
      }

      // FIN NOTIF
      //------------------------------------------------------

      // Relecture pour renvoyer un createdAt concret
      const saved = await msgRef.get();
      const savedData = saved.data() || {};
      const ts = savedData.createdAt;
      const createdAt =
        ts?.toDate?.() ||
        (typeof ts?.seconds === 'number' ? new Date(ts.seconds * 1000) : new Date());

      return res.status(201).json({ message: { id: saved.id, ...savedData, createdAt } });
    } catch (err) {
      console.error('[P-MESSAGES][SEND][ERROR]', err);
      const code = err.message === 'Forbidden' ? 403 : (err.message === 'Conversation not found' ? 404 : 500);
      return res.status(code).json({ error: err.message || 'Failed to send message' });
    }
  }
);


/** Lister les messages d’une conversation */
router.get(
  '/conversations/:conversationId/messages',
  authGuard,
  [
    param('conversationId').isString().notEmpty(),
    query('limit').optional().isInt({ min: 1, max: 100 }),
    query('before').optional().isISO8601().toDate(),
  ],
  async (req, res) => {
    const bad = handleValidation(req, res); if (bad) return bad;

    const { conversationId } = req.params;
    const partnerUid = req.user.uid;
       const limit = parseInt(req.query.limit || '20', 10);

    const convRef = db.collection('conversations').doc(conversationId);

    try {
      const convSnap = await convRef.get();
      if (!convSnap.exists) return res.status(404).json({ error: 'Conversation not found' });
      const conv = convSnap.data();
      if (conv.partnerUid !== partnerUid) return res.status(403).json({ error: 'Forbidden' });

      let q = convRef.collection('messages').orderBy('createdAt', 'desc').limit(limit);
      if (req.query.before) {
        q = q.where('createdAt', '<', admin.firestore.Timestamp.fromDate(req.query.before));
      }

      const snaps = await q.get();
      const messages = snaps.docs.map(d => ({ id: d.id, ...d.data() }));
      const nextBefore = messages.length
        ? messages[messages.length - 1].createdAt?.toDate?.()?.toISOString?.() || null
        : null;

      return res.json({ messages, nextBefore });
    } catch (err) {
      console.error('[P-MESSAGES][LIST][ERROR]', err);
      return res.status(500).json({ error: 'Failed to list messages' });
    }
  }
);

/** Marquer la conversation comme lue par le partenaire */
router.post(
  '/conversations/:conversationId/read',
  authGuard,
  [ param('conversationId').isString().notEmpty() ],
  async (req, res) => {
    const bad = handleValidation(req, res); if (bad) return bad;

    const { conversationId } = req.params;
    const partnerUid = req.user.uid;
    const convRef = db.collection('conversations').doc(conversationId);

    try {
      await db.runTransaction(async (tx) => {
        const convSnap = await tx.get(convRef);
        if (!convSnap.exists) throw new Error('Conversation not found');

        const conv = convSnap.data();
        if (conv.partnerUid !== partnerUid) throw new Error('Forbidden');

        tx.update(convRef, {
          'unread.partner': 0,
          'reads.partner': FieldValue.serverTimestamp(),
        });
      });

      return res.json({ ok: true });
    } catch (err) {
      console.error('[P-MESSAGES][READ][ERROR]', err);
      const code = err.message === 'Forbidden' ? 403 : (err.message === 'Conversation not found' ? 404 : 500);
      return res.status(code).json({ error: err.message || 'Failed to mark read' });
    }
  }
);

/** Indicateur de saisie côté partenaire */
router.post(
  '/conversations/:conversationId/typing',
  authGuard,
  [
    param('conversationId').isString().notEmpty(),
    body('typing').isBoolean().withMessage('typing must be boolean'),
  ],
  async (req, res) => {
    const bad = handleValidation(req, res); if (bad) return bad;

    const { conversationId } = req.params;
    const { typing } = req.body;
    const partnerUid = req.user.uid;

    const convRef = db.collection('conversations').doc(conversationId);

    try {
      const snap = await convRef.get();
      if (!snap.exists) return res.status(404).json({ error: 'Conversation not found' });
      const conv = snap.data();
      if (conv.partnerUid !== partnerUid) return res.status(403).json({ error: 'Forbidden' });

      await convRef.update({ 'typing.partner': typing === true });

      return res.json({ ok: true });
    } catch (err) {
      console.error('[P-MESSAGES][TYPING][ERROR]', err);
      return res.status(500).json({ error: 'Failed to update typing state' });
    }
  }
);

module.exports = router;
