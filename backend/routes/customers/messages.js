const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { db, admin } = require('../../config/firebase');
const authGuard = require('../../middleware/authGuard');

const router = express.Router();
const FieldValue = admin.firestore.FieldValue;

/* -------------------- helpers -------------------- */
function handleValidation(req, res) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(422).json({ errors: result.array({ onlyFirstError: true }) });
  }
}


async function pushMessageNotif(customerId, { conversationId, preview }) {
  const col = db.collection("customers")
    .doc(customerId)
    .collection("notifs");

  const payload = {
    type: "message",
    title: "Nouveau message",
    body: preview || "Vous avez reçu un nouveau message.",
    data: { conversationId },
    status: "unread",
    createdAt: new Date(),
    readAt: null,
  };

  await col.add(payload);
}


// lit un doc et choisit le meilleur displayName en fonction du type
async function getDocName(kind /* 'customer'|'partner'|'user' */, uid) {
  try {
    if (!uid) return null;
    const col =
      kind === 'customer' ? 'customers' :
      kind === 'partner'  ? 'partners'  : 'users';

    const snap = await db.collection(col).doc(uid).get();
    if (!snap.exists) return null;
    const u = snap.data() || {};

    // Priorités "pro":
    // - partner → nomOwner d'abord
    // - customer → user d'abord
    let preferred = null;
    if (kind === 'partner')  preferred = u.nomOwner;
    if (kind === 'customer') preferred = u.user;

    const n =
      preferred ||
      u.displayName ||
      u.fullName ||
      u.name ||
      [u.firstName, u.lastName].filter(Boolean).join(' ');

    return (n && String(n).trim()) || null;
  } catch { return null; }
}

async function getAuthName(uid) {
  try {
    if (!uid) return null;
    const user = await admin.auth().getUser(uid);
    const dn = user.displayName || (user.email ? user.email.split('@')[0] : null);
    return dn ? String(dn).trim() : null;
  } catch { return null; }
}

async function resolveDisplayName(kind /* 'customer'|'partner' */, uid) {
  // 1) collection dédiée (avec la priorité nomOwner/user)
  const c1 = await getDocName(kind, uid);
  if (c1) return c1;
  // 2) collection users générique
  const c2 = await getDocName('user', uid);
  if (c2) return c2;
  // 3) Firebase Auth
  const c3 = await getAuthName(uid);
  if (c3) return c3;
  return null;
}

/** ID de conversation déterministe */
function convIdOf({ customerId, partnerUid, serviceId }) {
  const sid = serviceId ? String(serviceId) : 'general';
  return `c_${customerId}__p_${partnerUid}__s_${sid}`;
}

/* -------------------- créer / récupérer une conv -------------------- */
router.post(
  '/conversations',
  authGuard,
  [
    body('partnerUid').isString().trim().notEmpty(),
    body('serviceId').optional().isString().trim(),
    body('partnerSlug').optional().isString().trim(),
    body('partnerId').optional().isString().trim(),
  ],
  async (req, res) => {
    const bad = handleValidation(req, res); if (bad) return bad;

    const customerId = req.user.uid;
    const { partnerUid, serviceId, partnerSlug, partnerId } = req.body;

    const conversationId = convIdOf({ customerId, partnerUid, serviceId });
    const convRef = db.collection('conversations').doc(conversationId);

    try {
      // résout les noms hors transaction
      const [customerName, partnerName] = await Promise.all([
        resolveDisplayName('customer', customerId),
        resolveDisplayName('partner', partnerUid),
      ]);

      await db.runTransaction(async (tx) => {
        const snap = await tx.get(convRef);
        const now = FieldValue.serverTimestamp();

        if (!snap.exists) {
          tx.set(convRef, {
            participantKeys: [`customer:${customerId}`, `partner:${partnerUid}`],
            customerId,
            partnerUid,
            serviceId: serviceId || null,
            partnerSlug: partnerSlug || null,
            partnerId: partnerId || null,
            customerName: customerName || null,
            partnerName: partnerName || null,
            createdAt: now,
            updatedAt: now,
            lastMessage: null,
            unread: { customer: 0, partner: 0 },
            reads: { customer: null, partner: null },
            typing: { customer: false, partner: false },
          });
        } else {
          const data = snap.data() || {};
          const updates = {};
          if (!data.customerName && customerName) updates.customerName = customerName;
          if (!data.partnerName && partnerName)   updates.partnerName  = partnerName;
          if (Object.keys(updates).length) tx.update(convRef, updates);
        }
      });

      const doc = await convRef.get();
      return res.json({ conversation: { id: doc.id, ...doc.data() } });
    } catch (err) {
      console.error('[C-MESSAGES][CONV][ERROR]', err);
      return res.status(500).json({ error: 'Failed to create/fetch conversation' });
    }
  }
);

/* -------------------- lister les convs (client) -------------------- */
router.get(
  '/conversations',
  authGuard,
  [
    query('limit').optional().isInt({ min: 1, max: 50 }),
    query('cursor').optional().isISO8601().toDate(),
  ],
  async (req, res) => {
    const bad = handleValidation(req, res); if (bad) return bad;

    const customerId = req.user.uid;
    const limit = parseInt(req.query.limit || '12', 10);

    try {
      let q = db.collection('conversations')
        .where('participantKeys', 'array-contains', `customer:${customerId}`)
        .orderBy('updatedAt', 'desc')
        .limit(limit);

      if (req.query.cursor) {
        // req.query.cursor a déjà été toDate() → Date
        const ts = admin.firestore.Timestamp.fromDate(req.query.cursor);
        const cursorQ = await db.collection('conversations')
          .where('participantKeys', 'array-contains', `customer:${customerId}`)
          .orderBy('updatedAt', 'desc')
          .startAt(ts)
          .limit(1).get();
        if (!cursorQ.empty) q = q.startAfter(cursorQ.docs[0]);
      }

      const snaps = await q.get();
      let conversations = snaps.docs.map(d => ({ id: d.id, ...d.data() }));

      // hydrate/persiste les noms manquants
      await Promise.all(conversations.map(async (c) => {
        try {
          const updates = {};
          if (!c.customerName && c.customerId) {
            const n = await resolveDisplayName('customer', c.customerId);
            if (n) { c.customerName = n; updates.customerName = n; }
          }
          if (!c.partnerName && c.partnerUid) {
            const n = await resolveDisplayName('partner', c.partnerUid);
            if (n) { c.partnerName = n; updates.partnerName = n; }
          }
          if (Object.keys(updates).length) {
            db.collection('conversations').doc(c.id).update(updates).catch(() => {});
          }
        } catch {}
      }));

      const nextCursor = conversations.length
        ? conversations[conversations.length - 1].updatedAt?.toDate?.()?.toISOString?.() || null
        : null;

      return res.json({ conversations, nextCursor });
    } catch (err) {
      // fallback si l’index composite manque
      const msg = String(err.details || err.message || '');
      const needsIndex = msg.includes('The query requires an index');
      const building   = msg.includes('index is currently building');

      if (needsIndex || building) {
        try {
          const snaps2 = await db.collection('conversations')
            .where('participantKeys', 'array-contains', `customer:${customerId}`)
            .limit(limit * 2)
            .get();

        let conversations = snaps2.docs.map(d => ({ id: d.id, ...d.data() }));
        conversations.sort((a, b) => {
          const ta = a.updatedAt?.toMillis?.() ?? a.updatedAt?.toDate?.()?.getTime?.() ?? 0;
          const tb = b.updatedAt?.toMillis?.() ?? b.updatedAt?.toDate?.()?.getTime?.() ?? 0;
          return tb - ta; // desc
        });
        conversations = conversations.slice(0, limit);

        // hydrate
        await Promise.all(conversations.map(async (c) => {
          try {
            const updates = {};
            if (!c.customerName && c.customerId) {
              const n = await resolveDisplayName('customer', c.customerId);
              if (n) { c.customerName = n; updates.customerName = n; }
            }
            if (!c.partnerName && c.partnerUid) {
              const n = await resolveDisplayName('partner', c.partnerUid);
              if (n) { c.partnerName = n; updates.partnerName = n; }
            }
            if (Object.keys(updates).length) {
              db.collection('conversations').doc(c.id).update(updates).catch(() => {});
            }
          } catch {}
        }));

        return res.status(200).json({
          conversations,
          nextCursor: null,
          note: building ? 'fallback_no_orderby_index_building' : 'fallback_no_orderby_index_missing'
        });
        } catch (e2) {
          console.error('[C-MESSAGES][CONV_LIST][FALLBACK][ERROR]', e2);
          return res.status(503).json({ error: 'Firestore index initializing; temporary fallback failed.' });
        }
      }

      console.error('[C-MESSAGES][CONV_LIST][ERROR]', err);
      return res.status(500).json({ error: 'Failed to list conversations' });
    }
  }
);

/* -------------------- envoyer un message -------------------- */


router.post(
  '/conversations/:conversationId/messages',
  authGuard,
  [
    param('conversationId').isString().notEmpty(),
    body('text')
      .customSanitizer(v => (v == null ? '' : String(v))).trim()
      .notEmpty().isLength({ max: 4000 }),
  ],
  async (req, res) => {
    const bad = handleValidation(req, res); 
    if (bad) return bad;

    const { conversationId } = req.params;
    const { text } = req.body;
    const customerId = req.user.uid;

    const convRef = db.collection('conversations').doc(conversationId);
    const msgRef = convRef.collection('messages').doc();

    try {
      await db.runTransaction(async (tx) => {
        const convSnap = await tx.get(convRef);
        if (!convSnap.exists) throw new Error('Conversation not found');

        const conv = convSnap.data();
        if (conv.customerId !== customerId) throw new Error('Forbidden');

        const now = FieldValue.serverTimestamp();
        const msg = {
          text,
          senderId: customerId,
          senderRole: 'customer',
          createdAt: now,
          attachments: [],
          readBy: ['customer'],
        };

        tx.set(msgRef, msg);
        tx.update(convRef, {
          updatedAt: now,
          lastMessage: { text, at: now, senderId: customerId, senderRole: 'customer' },
          'unread.partner': FieldValue.increment(1),
        });
      });

      // 🔔 Ajouter la notif au partenaire
      const conv = (await convRef.get()).data();
      await pushMessageNotif(conv.partnerUid, {
        conversationId,
        preview: text.slice(0, 120),
      });

      // Relecture
      const saved = await msgRef.get();
      const savedData = saved.data() || {};

      const ts = savedData.createdAt;
      const createdAt =
        ts?.toDate?.() ||
        (typeof ts?.seconds === 'number' ? new Date(ts.seconds * 1000) : new Date());

      return res.status(201).json({
        message: { id: saved.id, ...savedData, createdAt }
      });

    } catch (err) {
      console.error('[C-MESSAGES][SEND][ERROR]', err);
      const code = err.message === 'Forbidden' ? 403 :
                   err.message === 'Conversation not found' ? 404 : 500;

      return res.status(code).json({ error: err.message || 'Failed to send message' });
    }
  }
);





/* -------------------- lister les messages -------------------- */
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
    const limit = parseInt(req.query.limit || '20', 10);
    const customerId = req.user.uid;

    const convRef = db.collection('conversations').doc(conversationId);

    try {
      const convSnap = await convRef.get();
      if (!convSnap.exists) return res.status(404).json({ error: 'Conversation not found' });
      const conv = convSnap.data();
      if (conv.customerId !== customerId) return res.status(403).json({ error: 'Forbidden' });

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
      console.error('[C-MESSAGES][LIST][ERROR]', err);
      return res.status(500).json({ error: 'Failed to list messages' });
    }
  }
);

/* -------------------- lire / typing -------------------- */
router.post(
  '/conversations/:conversationId/read',
  authGuard,
  [ param('conversationId').isString().notEmpty() ],
  async (req, res) => {
    const bad = handleValidation(req, res); if (bad) return bad;

    const { conversationId } = req.params;
    const customerId = req.user.uid;
    const convRef = db.collection('conversations').doc(conversationId);

    try {
      await db.runTransaction(async (tx) => {
        const convSnap = await tx.get(convRef);
        if (!convSnap.exists) throw new Error('Conversation not found');
        const conv = convSnap.data();
        if (conv.customerId !== customerId) throw new Error('Forbidden');

        tx.update(convRef, {
          'unread.customer': 0,
          'reads.customer': FieldValue.serverTimestamp(),
        });
      });

      return res.json({ ok: true });
    } catch (err) {
      console.error('[C-MESSAGES][READ][ERROR]', err);
      const code = err.message === 'Forbidden' ? 403 : (err.message === 'Conversation not found' ? 404 : 500);
      return res.status(code).json({ error: err.message || 'Failed to mark read' });
    }
  }
);

router.post(
  '/conversations/:conversationId/typing',
  authGuard,
  [
    param('conversationId').isString().notEmpty(),
    body('typing').isBoolean(),
  ],
  async (req, res) => {
    const bad = handleValidation(req, res); if (bad) return bad;

    const { conversationId } = req.params;
    const { typing } = req.body;
    const customerId = req.user.uid;

    const convRef = db.collection('conversations').doc(conversationId);

    try {
      const snap = await convRef.get();
      if (!snap.exists) return res.status(404).json({ error: 'Conversation not found' });
      const conv = snap.data();
      if (conv.customerId !== customerId) return res.status(403).json({ error: 'Forbidden' });

      await convRef.update({ 'typing.customer': typing === true });
      return res.json({ ok: true });
    } catch (err) {
      console.error('[C-MESSAGES][TYPING][ERROR]', err);
      return res.status(500).json({ error: 'Failed to update typing state' });
    }
  }
);

module.exports = router;
