// Vercel serverless function wrapper for Express app
// Import from built dist folder (built by npm run build)
import app from '../dist/index.js';

// Export the Express app as the serverless handler
export default app;
