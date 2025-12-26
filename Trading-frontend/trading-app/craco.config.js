const webpack = require('webpack');
const fs = require('fs');

// Silence the DeprecationWarning: fs.F_OK is deprecated
// This attempts to overwrite the deprecated property with the constant value directly
try {
    if (fs.constants && fs.constants.F_OK) {
        Object.defineProperty(fs, 'F_OK', { value: fs.constants.F_OK, writable: true });
    }
} catch (e) {
    // Ignore if we can't patch it
}


module.exports = {
    devServer: (devServerConfig, { env, paths, proxy, allowedHost }) => {
        // Current react-scripts use deprecated onBeforeSetupMiddleware / onAfterSetupMiddleware
        // This override migrates them to setupMiddlewares for webpack-dev-server 4.7+

        devServerConfig.setupMiddlewares = (middlewares, devServer) => {
            if (!devServer) {
                throw new Error('webpack-dev-server is not defined');
            }

            if (devServerConfig.onBeforeSetupMiddleware) {
                devServerConfig.onBeforeSetupMiddleware(devServer);
            }

            if (devServerConfig.onAfterSetupMiddleware) {
                devServerConfig.onAfterSetupMiddleware(devServer);
            }

            return middlewares;
        };

        delete devServerConfig.onBeforeSetupMiddleware;
        delete devServerConfig.onAfterSetupMiddleware;

        return devServerConfig;
    },
};
