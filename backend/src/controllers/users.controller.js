const { ROLES, listUsers, createUser, updateUser, deleteUser } = require('../services/user.service');

async function getUsers(req, res, next) {
  try {
    const users = await listUsers();
    return res.json({ success: true, users });
  } catch (e) {
    return next(e);
  }
}

async function postUser(req, res, next) {
  try {
    const { email, password, role } = req.body || {};
    
    // Only ADMIN users can create users (already enforced by authorize middleware)
    const result = await createUser({ email, password, role });
    
    // Return user data with temporary password
    return res.status(201).json({ 
      success: true, 
      user: {
        id: result.id,
        email: result.email,
        role: result.role,
        must_change_password: result.must_change_password
      },
      temporaryPassword: result.temporaryPassword // Only returned once in API response
    });
  } catch (e) {
    if (e.code === 'CONFLICT') {
      return res.status(409).json({ success: false, error: e.message });
    }
    if (e.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ success: false, error: e.message });
    }
    return next(e);
  }
}

async function putUser(req, res, next) {
  try {
    const { id } = req.params;
    const updates = req.body || {};
    const user = await updateUser(Number(id), updates);
    return res.json({ success: true, user });
  } catch (e) {
    if (e.code === 'VALIDATION_ERROR') {
      return res.status(400).json({ success: false, error: e.message });
    }
    return next(e);
  }
}

async function removeUser(req, res, next) {
  try {
    const { id } = req.params;
    await deleteUser(Number(id));
    return res.json({ success: true });
  } catch (e) {
    return next(e);
  }
}

module.exports = { getUsers, postUser, putUser, removeUser, ROLES };
 
