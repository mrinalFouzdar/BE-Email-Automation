import processEmails from './emailProcessor.js';
// Run the email processor
processEmails().then(() => {
    console.log('Email processing completed');
    process.exit(0);
}).catch((err) => {
    console.error('Error:', err);
    process.exit(1);
});
