import mongoose from 'mongoose';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

import User from '../src/models/User.model.js';
import AppConfig from '../src/models/AppConfig.model.js';

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB for seeding...');

    // Clear existing data
    await User.deleteMany({});
    await AppConfig.deleteMany({});
    console.log('Cleared existing users and config.');

    // Create admin
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@spinwheel.com',
      password: 'admin123',
      role: 'admin',
      coins: 999999,
    });
    console.log(`Admin created: ${admin.email}`);

    // Create 5 regular users
    const users = await User.create([
      { name: 'Alice',   email: 'alice@spinwheel.com',   password: 'user1234', coins: 5000 },
      { name: 'Bob',     email: 'bob@spinwheel.com',     password: 'user1234', coins: 5000 },
      { name: 'Charlie', email: 'charlie@spinwheel.com', password: 'user1234', coins: 5000 },
      { name: 'Diana',   email: 'diana@spinwheel.com',   password: 'user1234', coins: 5000 },
      { name: 'Eve',     email: 'eve@spinwheel.com',     password: 'user1234', coins: 5000 },
    ]);
    console.log(`${users.length} users created.`);

    // Create default AppConfig
    const config = await AppConfig.create({
      key: 'default',
      winnerPoolPct: 80,
      adminPoolPct: 15,
      appPoolPct: 5,
    });
    console.log(`AppConfig created: winner=${config.winnerPoolPct}% admin=${config.adminPoolPct}% app=${config.appPoolPct}%`);

    console.log('\n--- SEED COMPLETE ---');
    console.log('Admin login:  admin@spinwheel.com / admin123');
    console.log('User login:   alice@spinwheel.com / user1234');
    console.log('---------------------\n');

    process.exit(0);
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  }
};

seed();