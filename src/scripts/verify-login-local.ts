import { database } from '../config/database.config';
import bcrypt from 'bcrypt';

async function verifyLogin() {
  try {
    await database.connect();
    console.log('✅ Connected to DB');
    
    // Get user
    const res = await database.getClient().query('SELECT * FROM users WHERE email = $1', ['admin@emailrag.com']);
    const user = res.rows[0];

    if (!user) {
      console.log('❌ User admin@emailrag.com not found!');  // changed to console.log
      return;
    }

    console.log('👤 User Found:', { id: user.id, email: user.email, role: user.role });

    const passwordToTest = 'admin123456';
    const isMatch = await bcrypt.compare(passwordToTest, user.password_hash);

    if (isMatch) {
      console.log(`✅ SUCCESS: Password '${passwordToTest}' MATCHES the stored hash.`);
    } else {
      console.log(`❌ FAILURE: Password '${passwordToTest}' DOES NOT match stored hash.`);
      console.log('Stored Hash:', user.password_hash);
      
      // Suggesting fix
      const newHash = await bcrypt.hash(passwordToTest, 10);
      console.log('Suggested Hash for admin123456:', newHash);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await database.disconnect();
  }
}

verifyLogin();
