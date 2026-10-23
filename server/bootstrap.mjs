import { runtimeConfig } from './config.mjs';
import { initializeAdmin } from './init.mjs';
import { startServer } from './index.mjs';
const config=runtimeConfig();
initializeAdmin(config);
startServer(config);
