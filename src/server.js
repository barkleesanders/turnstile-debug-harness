import { createApp } from './app.js';
import { getConfig } from './config.js';

const runtimeConfig = getConfig();
const app = createApp({ config: runtimeConfig });
const port = runtimeConfig.port || 3000;

app.listen(port, () => {
  console.log(`Cloudflare Turnstile demo listening on http://localhost:${port}`);
});
