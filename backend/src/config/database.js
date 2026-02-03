const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.MYSQL_DATABASE || 'snam_baitong',
  process.env.MYSQL_USER || 'root',
  process.env.MYSQL_PASSWORD || '',
  {
    host: process.env.MYSQL_HOST || 'localhost',
    dialect: 'mysql',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

async function testConnection() {
  try {
    await sequelize.authenticate();
    console.log('✓ Database connection established successfully');
    return true;
  } catch (error) {
    console.error('✗ Unable to connect to database:', error.message);
    return false;
  }
}

async function syncDatabase() {
  try {
    await sequelize.sync({ alter: true });
    console.log('✓ Database synchronized successfully');
    return true;
  } catch (error) {
    console.error('✗ Database sync failed:', error.message);
    return false;
  }
}

module.exports = {
  sequelize,
  testConnection,
  syncDatabase
};
