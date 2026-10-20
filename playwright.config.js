import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir:'./tests/browser', use:{ baseURL:'http://localhost:8889', headless:true }, reporter:'list', outputDir:'/tmp/natr-test-results' });
