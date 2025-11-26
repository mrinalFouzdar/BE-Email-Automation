import processAllAccounts from './emailProcessor';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log('Starting manual email processing...');
  await processAllAccounts();
  console.log('Finished manual email processing.');
}

main().catch(console.error);
