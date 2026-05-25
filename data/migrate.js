require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const dbJsonPath = path.join(__dirname, 'db.json');

async function migrate() {
  console.log('🚀 Starting PostgreSQL migration...');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ Error: DATABASE_URL is not set in environment or .env file.');
    process.exit(1);
  }

  if (!fs.existsSync(dbJsonPath)) {
    console.error(`❌ Error: Local database file not found at ${dbJsonPath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(dbJsonPath, 'utf8');
  let data;
  try {
    data = JSON.parse(rawData);
  } catch (err) {
    console.error('❌ Error parsing db.json:', err);
    process.exit(1);
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log('✅ Connected to PostgreSQL database.');

    // 1. Create Tables
    console.log('📦 Creating database tables if they do not exist...');
    
    await client.query(`
      CREATE TABLE IF NOT EXISTS admins (
        username VARCHAR(255) PRIMARY KEY,
        password VARCHAR(255) NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS settings (
        key VARCHAR(255) PRIMARY KEY,
        value JSONB NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS quizzes (
        id VARCHAR(255) PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE,
        title VARCHAR(255) NOT NULL,
        description TEXT,
        icon VARCHAR(50),
        color VARCHAR(50),
        questions JSONB NOT NULL DEFAULT '[]'::jsonb
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id VARCHAR(255) PRIMARY KEY,
        created_at TIMESTAMP WITH TIME ZONE,
        title VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        icon VARCHAR(50),
        color VARCHAR(50),
        description TEXT,
        sections JSONB NOT NULL DEFAULT '[]'::jsonb
      );
    `);

    console.log('✅ Tables created successfully.');

    // Start Transaction
    await client.query('BEGIN');

    // 2. Insert Admin Data
    if (data.admin) {
      console.log('👤 Migrating Admin user...');
      await client.query(
        `INSERT INTO admins (username, password) 
         VALUES ($1, $2) 
         ON CONFLICT (username) DO UPDATE SET password = EXCLUDED.password`,
        [data.admin.username, data.admin.password]
      );
    }

    // 3. Insert Settings Data
    if (data.settings) {
      console.log('⚙️ Migrating Settings...');
      for (const [key, value] of Object.entries(data.settings)) {
        await client.query(
          `INSERT INTO settings (key, value) 
           VALUES ($1, $2) 
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
          [key, JSON.stringify(value)]
        );
      }
    }

    // 4. Insert Quizzes
    if (Array.isArray(data.quizzes)) {
      console.log(`📝 Migrating ${data.quizzes.length} Quizzes...`);
      for (const quiz of data.quizzes) {
        await client.query(
          `INSERT INTO quizzes (id, created_at, title, description, icon, color, questions) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) 
           ON CONFLICT (id) DO UPDATE SET 
             created_at = EXCLUDED.created_at, 
             title = EXCLUDED.title, 
             description = EXCLUDED.description, 
             icon = EXCLUDED.icon, 
             color = EXCLUDED.color, 
             questions = EXCLUDED.questions`,
          [
            quiz.id,
            quiz.createdAt ? new Date(quiz.createdAt) : new Date(),
            quiz.title,
            quiz.description,
            quiz.icon,
            quiz.color,
            JSON.stringify(quiz.questions || [])
          ]
        );
      }
    }

    // 5. Insert Reviews
    if (Array.isArray(data.reviews)) {
      console.log(`📚 Migrating ${data.reviews.length} Reviews...`);
      for (const review of data.reviews) {
        await client.query(
          `INSERT INTO reviews (id, created_at, title, subject, icon, color, description, sections) 
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
           ON CONFLICT (id) DO UPDATE SET 
             created_at = EXCLUDED.created_at, 
             title = EXCLUDED.title, 
             subject = EXCLUDED.subject, 
             icon = EXCLUDED.icon, 
             color = EXCLUDED.color, 
             description = EXCLUDED.description, 
             sections = EXCLUDED.sections`,
          [
            review.id,
            review.createdAt ? new Date(review.createdAt) : new Date(),
            review.title,
            review.subject,
            review.icon,
            review.color,
            review.description,
            JSON.stringify(review.sections || [])
          ]
        );
      }
    }

    // Commit Transaction
    await client.query('COMMIT');
    console.log('🎉 Migration transaction committed successfully.');

    // Verification queries
    const adminsCount = await client.query('SELECT COUNT(*) FROM admins');
    const settingsCount = await client.query('SELECT COUNT(*) FROM settings');
    const quizzesCount = await client.query('SELECT COUNT(*) FROM quizzes');
    const reviewsCount = await client.query('SELECT COUNT(*) FROM reviews');

    console.log('\n📊 Migration Summary:');
    console.log(`- Admins: ${adminsCount.rows[0].count} imported`);
    console.log(`- Settings: ${settingsCount.rows[0].count} imported`);
    console.log(`- Quizzes: ${quizzesCount.rows[0].count} imported`);
    console.log(`- Reviews: ${reviewsCount.rows[0].count} imported`);
    console.log('✅ Migration validation complete.');

  } catch (err) {
    console.error('❌ Migration failed, rolling back. Error:', err);
    try {
      await client.query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('❌ Rollback failed:', rollbackErr);
    }
    process.exit(1);
  } finally {
    await client.end();
  }
}

migrate();
