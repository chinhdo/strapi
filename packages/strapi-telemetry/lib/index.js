'use strict';
/**
 * Strapi telemetry package.
 * You can learn more at https://strapi.io/documentation/3.0.0-beta.x/global-strapi/usage-information.html#commitment-to-our-users-data-collection
 */
const os = require('os');

const isDocker = require('is-docker');
const { machineIdSync } = require('node-machine-id');
const fetch = require('node-fetch');
const ciEnv = require('ci-info');
const { scheduleJob } = require('node-schedule');

const createMiddleware = require('./middleware');
const isTruthyEnvVar = require('./truthy-var');

const createTelemetryInstance = strapi => {
  const uuid = strapi.config.uuid;
  const deviceId = machineIdSync();

  const isDisabled = !uuid || isTruthyEnvVar(process.env.STRAPI_TELEMETRY_DISABLED);

  const anonymous_metadata = {
    environment: strapi.config.environment,
    os: os.type(),
    osPlatform: os.platform(),
    osRelease: os.release(),
    nodeVersion: process.version,
    docker: process.env.DOCKER || isDocker(),
    isCI: ciEnv.isCI,
    version: strapi.config.info.strapi,
    strapiVersion: strapi.config.info.strapi,
  };

  const sendEvent = async (event, payload) => {
    // do not send anything when user has disabled analytics
    if (isDisabled) return true;

    try {
      const res = await fetch('https://analytics.strapi.io/track', {
        method: 'POST',
        body: JSON.stringify({
          event,
          uuid,
          deviceId,
          properties: {
            ...payload,
            ...anonymous_metadata,
          },
        }),
        timeout: 1000,
        headers: { 'Content-Type': 'application/json' },
      });

      return res.ok;
    } catch (err) {
      return false;
    }
  };

  const initPing = () => {
    if (isDisabled) {
      return;
    }

    scheduleJob('0 0 12 * * *', () => sendEvent('ping'));
  };

  return {
    initPing,
    send: sendEvent,
    middleware: createMiddleware({ sendEvent, isDisabled }),
  };
};

module.exports = createTelemetryInstance;
