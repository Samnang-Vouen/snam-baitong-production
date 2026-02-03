const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/database');

// Define allowed roles
const ROLES = {
  ADMIN: 'admin',
  MINISTRY: 'ministry',
};

// User Model Definition
const User = sequelize.define(
  'User',
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: {
        name: 'unique_email',
        msg: 'Email address already in use',
      },
      validate: {
        isEmail: {
          msg: 'Must be a valid email address',
        },
        notEmpty: {
          msg: 'Email cannot be empty',
        },
      },
    },
    password_hash: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'password_hash',
    },
    password: {
      type: DataTypes.VIRTUAL,
      set(value) {
        // Store the value so it can be accessed in hooks
        this.setDataValue('password', value);
      },
      validate: {
        notEmpty: {
          msg: 'Password cannot be empty',
        },
        len: {
          args: [6, 100],
          msg: 'Password must be between 6 and 100 characters',
        },
      },
    },
    role: {
      type: DataTypes.ENUM('admin', 'ministry'),
      allowNull: false,
      defaultValue: 'ministry',
      validate: {
        isIn: {
          args: [['admin', 'ministry']],
          msg: 'Role must be either admin or ministry',
        },
      },
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    must_change_password: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      field: 'must_change_password',
    },
  },
  {
    tableName: 'users',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    hooks: {
      // Hash password before creating user
      beforeCreate: async (user) => {
        const plainPassword = user.getDataValue('password') || user.password;
        if (plainPassword) {
          const salt = await bcrypt.genSalt(10);
          const hash = await bcrypt.hash(plainPassword, salt);
          user.setDataValue('password_hash', hash);
        }
      },
      // Hash password before updating user (if password changed)
      beforeUpdate: async (user) => {
        const plainPassword = user.getDataValue('password') || user.password;
        if (plainPassword && user.changed('password')) {
          const salt = await bcrypt.genSalt(10);
          const hash = await bcrypt.hash(plainPassword, salt);
          user.setDataValue('password_hash', hash);
        }
      },
    },
  }
);

// Instance method to verify password
User.prototype.verifyPassword = async function (password) {
  return bcrypt.compare(password, this.password_hash);
};

// Instance method to get safe user data (without password)
User.prototype.toSafeObject = function () {
  const { password, password_hash, ...safeUser } = this.toJSON();
  return safeUser;
};

module.exports = {
  User,
  ROLES,
};
