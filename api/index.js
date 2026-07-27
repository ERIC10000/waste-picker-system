/**
 * Vercel serverless entry point.
 *
 * Vercel treats every file in this directory as a function; exporting the
 * Express app hands it every request that reaches /api/*. All the actual
 * routing lives in server/src/app.js so local and deployed behaviour match.
 */
export { default } from '../server/src/app.js';
