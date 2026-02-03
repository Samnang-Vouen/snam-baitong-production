const { query } = require('../services/mysql');

async function initCommentsSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS comments (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      entity_type VARCHAR(64) NOT NULL,
      entity_id VARCHAR(64) NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_entity (entity_type, entity_id),
      CONSTRAINT fk_comments_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);
}

async function postComment(req, res, next) {
  try {
    const { entity_type, entity_id, content } = req.body || {};
    if (!entity_type || !entity_id || !content) {
      return res.status(400).json({ success: false, error: 'entity_type, entity_id and content are required' });
    }
    const result = await query(
      'INSERT INTO comments (user_id, entity_type, entity_id, content) VALUES (?,?,?,?)',
      [req.user.id, entity_type, entity_id, content]
    );
    return res.status(201).json({ success: true, id: result.insertId });
  } catch (e) {
    return next(e);
  }
}

async function getComments(req, res, next) {
  try {
    const { entity_type, entity_id } = req.query || {};
    if (!entity_type || !entity_id) {
      return res.status(400).json({ success: false, error: 'entity_type and entity_id are required' });
    }
    const rows = await query(
      'SELECT c.id, c.user_id, c.entity_type, c.entity_id, c.content, c.created_at FROM comments c WHERE c.entity_type = ? AND c.entity_id = ? ORDER BY c.created_at DESC',
      [entity_type, entity_id]
    );
    return res.json({ success: true, comments: rows });
  } catch (e) {
    return next(e);
  }
}

module.exports = { initCommentsSchema, postComment, getComments };
