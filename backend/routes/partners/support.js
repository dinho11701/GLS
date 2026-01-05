// routes/partners/support.js
const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const { db, admin } = require('../../config/firebase');
const authGuard = require('../../middleware/authGuard');

const router = express.Router();
const FieldValue = admin.firestore.FieldValue;

// Config support GLS
const SUPPORT_TEAM_KEY = 'support:gls';         // participantKeys contains
const CHANNEL = 'partner-support';               // type de canal

function handleValidation(req, res) {
  const r = validationResult(req);
  if (!r.isEmpty()) return res.status(422).json({ errors: r.array({ onlyFirstError: true }) });
}

/** ID déterministe pour un ticket support (1 canal par partenaire + option sujet/catégorie) */
function supportConvIdOf({ partnerUid, topic }) {
  const t = topic ? String(topic).replace(/[^\w-]/g, '').slice(0, 40) : 'general';
  return `ps_${partnerUid}__t_${t}`;
}

/** Créer / récupérer une conversation support (idempotent)
 * POST /api/v1/partners/support/conversations
 * body: { topic?, category? }
 */
router.post(
  '/conversations',
  authGuard,
  [
    body('topic').optional().isString().trim().isLength({ max: 80 }),
    body('category').optional().isString().trim().isLength({ max: 40 }),
  ],
  async (req, res) => {
    const bad = handleValidation(req, res); if (bad) return bad;

    const partnerUid = req.user.uid;
    const { topic, category } = req.body;

    const conversationId = supportConvIdOf({ partnerUid, topic });
    const convRef = db.collection('conversations').doc(conversationId);

    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(convRef);
        if (!snap.exists) {
          const now = FieldValue.serverTimestamp();
          tx.set(convRef, {
            channel: CHANNEL,                                 // <— distingue des autres convs
            participantKeys: [`partner:${partnerUid}`, SUPPORT_TEAM_KEY],
            partnerUid,
            supportTeam: 'gls',
            topic: topic || null,
            category: category || null,
            createdAt: now,
            updatedAt: now,
            lastMessage: null,
            unread: { partner: 0, support: 0 },               // compteurs dédiés
            reads: { partner: null, support: null },
            typing: { partner: false, support: false },
          });
        }
      });

      const doc = await convRef.get();
      return res.json({ conversation: { id: doc.id, ...doc.data() } });
    } catch (err) {
      console.error('[P-SUPPORT][CONV_CREATE][ERROR]', err);
      return res.status(500).json({ error: 'Failed to create/fetch support conversation' });
    }
  }
);

/** Lister les conversations support du partenaire (tri par récence)
 * GET /api/v1/partners/support/conversations?limit=12
 */
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
      // voie standard — néc. index composite (participantKeys array-contains + channel == + orderBy)
      let q = db.collection('conversations')
        .where('participantKeys', 'array-contains', `partner:${partnerUid}`)
        .where('channel', '==', CHANNEL)
        .orderBy('updatedAt', 'desc')
        .limit(limit);

      if (req.query.cursor) {
        const cursorDate = req.query.cursor;
        const cursorQ = await db.collection('conversations')
          .where('participantKeys', 'array-contains', `partner:${partnerUid}`)
          .where('channel', '==', CHANNEL)
          .orderBy('updatedAt', 'desc')
          .startAt(cursorDate)
          .limit(1).get();
        if (!cursorQ.empty) q = q.startAfter(cursorQ.docs[0]);
      }

      const snaps = await q.get();
      const conversations = snaps.docs.map(d => ({ id: d.id, ...d.data() }));
      const nextCursor = conversations.length
        ? conversations[conversations.length - 1].updatedAt?.toDate()?.toISOString()
        : null;

      return res.json({ conversations, nextCursor });
    } catch (err) {
      // Fallback quand l’index est manquant/en build
      const msg = String(err.details || err.message || '');
      if (msg.includes('requires an index') || msg.includes('index is currently building')) {
        try {
          let q2 = db.collection('conversations')
            .where('participantKeys', 'array-contains', `partner:${partnerUid}`)
            .where('channel', '==', CHANNEL)
            .limit(limit * 2);

          const snaps2 = await q2.get();
          let conversations = snaps2.docs.map(d => ({ id: d.id, ...d.data() }));
          conversations.sort((a, b) => {
            const ta = a.updatedAt?.toMillis?.() ?? a.updatedAt?.toDate?.()?.getTime?.() ?? 0;
            const tb = b.updatedAt?.toMillis?.() ?? b.updatedAt?.toDate?.()?.getTime?.() ?? 0;
            return tb - ta;
          });
          conversations = conversations.slice(0, limit);
          return res.json({ conversations, nextCursor: null, note: 'fallback_no_orderby' });
        } catch (e2) {
          console.error('[P-SUPPORT][CONV_LIST][FALLBACK][ERROR]', e2);
          return res.status(503).json({ error: 'Support conversations temporarily unavailable (index init).' });
        }
      }
      console.error('[P-SUPPORT][CONV_LIST][ERROR]', err);
      return res.status(500).json({ error: 'Failed to list support conversations' });
    }
  }
);

/** Envoyer un message au support
 * POST /api/v1/partners/support/conversations/:conversationId/messages
 * body: { text }
 */
router.post(
  '/conversations/:conversationId/messages',
  authGuard,
  [
    param('conversationId').isString().notEmpty(),
    body('text').customSanitizer(v => (v == null ? '' : String(v))).trim()
      .notEmpty().withMessage('text is required').isLength({ max: 4000 }),
  ],
  async (req, res) => {
    const bad = handleValidation(req, res); if (bad) return bad;

    const { conversationId } = req.params;
    const { text } = req.body;
    const partnerUid = req.user.uid;

    const convRef = db.collection('conversations').doc(conversationId);
    const msgRef = convRef.collection('messages').doc();

    try {
      await db.runTransaction(async (tx) => {
        const convSnap = await tx.get(convRef);
        if (!convSnap.exists) throw new Error('Conversation not found');

        const conv = convSnap.data();
        if (conv.partnerUid !== partnerUid || conv.channel !== CHANNEL) {
          throw new Error('Forbidden');
        }

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
          'unread.support': FieldValue.increment(1),   // côté support
        });
      });

      const saved = await msgRef.get();
      return res.status(201).json({ message: { id: saved.id, ...saved.data() } });
    } catch (err) {
      console.error('[P-SUPPORT][SEND][ERROR]', err);
      const code = err.message === 'Forbidden' ? 403 : (err.message === 'Conversation not found' ? 404 : 500);
      return res.status(code).json({ error: err.message || 'Failed to send message' });
    }
  }
);

/** Lister les messages d’une conversation support
 * GET /api/v1/partners/support/conversations/:conversationId/messages?limit=20&before=<iso>
 */
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
      if (conv.partnerUid !== partnerUid || conv.channel !== CHANNEL) return res.status(403).json({ error: 'Forbidden' });

      let q = convRef.collection('messages').orderBy('createdAt', 'desc').limit(limit);
      if (req.query.before) {
        q = q.where('createdAt', '<', admin.firestore.Timestamp.fromDate(req.query.before));
      }

      const snaps = await q.get();
      const messages = snaps.docs.map(d => ({ id: d.id, ...d.data() }));
      const nextBefore = messages.length ? messages[messages.length - 1].createdAt?.toDate()?.toISOString() : null;

      return res.json({ messages, nextBefore });
    } catch (err) {
      console.error('[P-SUPPORT][LIST][ERROR]', err);
      return res.status(500).json({ error: 'Failed to list messages' });
    }
  }
);

/** Marquer la conversation comme lue par le partenaire
 * POST /api/v1/partners/support/conversations/:conversationId/read
 */
router.post(
  '/conversations/:conversationId/read',
  authGuard,
  [param('conversationId').isString().notEmpty()],
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
        if (conv.partnerUid !== partnerUid || conv.channel !== CHANNEL) throw new Error('Forbidden');

        tx.update(convRef, {
          'unread.partner': 0,
          'reads.partner': FieldValue.serverTimestamp(),
        });
      });

      return res.json({ ok: true });
    } catch (err) {
      console.error('[P-SUPPORT][READ][ERROR]', err);
      const code = err.message === 'Forbidden' ? 403 : (err.message === 'Conversation not found' ? 404 : 500);
      return res.status(code).json({ error: err.message || 'Failed to mark read' });
    }
  }
);

module.exports = router;
