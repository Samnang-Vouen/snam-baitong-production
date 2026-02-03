const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { login, logout } = require('../services/auth.service');
const { getById, updateUser } = require('../services/user.service');

async function postLogin(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'email and password are required' });
    }
    const result = await login(email, password);
    
    // Set HTTP-only cookie with token
    res.cookie('token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
    
    // Also return token in response body for localStorage backup
    return res.json({ success: true, user: result.user, token: result.token });
  } catch (e) {
    if (e.code === 'AUTH_FAILED') {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    return next(e);
  }
}

async function postLogout(req, res, next) {
  try {
    // Get token from cookie
    const token = req.cookies.token;
    if (token) {
      const decoded = jwt.decode(token);
      if (decoded && decoded.jti) {
        await logout(decoded);
      }
    }
    
    // Clear cookie
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax'
    });
    
    return res.json({ success: true });
  } catch (e) {
    return next(e);
  }
}

async function getMe(req, res, next) {
  try {
    // req.user is set by authenticate middleware
    // Get full user details from database
    const user = await getById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    return res.json({ 
      success: true, 
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        mustChangePassword: user.must_change_password || false
      }
    });
  } catch (e) {
    return next(e);
  }
}

async function updatePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body || {};
    
    // Validate input
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ 
        success: false, 
        error: 'Current password and new password are required' 
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ 
        success: false, 
        error: 'New password must be at least 6 characters long' 
      });
    }
    
    // Get user from database
    const user = await getById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ 
        success: false, 
        error: 'Current password is incorrect' 
      });
    }
    
    // Update password and reset must_change_password flag
    await updateUser(user.id, { 
      password: newPassword,
      must_change_password: 0
    });
    
    return res.json({ 
      success: true, 
      message: 'Password updated successfully' 
    });
  } catch (e) {
    return next(e);
  }
}

module.exports = { postLogin, postLogout, getMe, updatePassword };
 
 
