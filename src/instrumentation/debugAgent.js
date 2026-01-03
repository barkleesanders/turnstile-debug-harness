export class DebugAgent {
  constructor(logger = console) {
    this.logger = logger;
  }

  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      res.on('finish', () => {
        this.logger.info?.(
          `[debug-agent] ${req.method} ${req.originalUrl} -> ${res.statusCode} in ${Date.now() - start}ms`
        );
      });
      next();
    };
  }

  trace(event, payload = {}) {
    this.logger.info?.('[debug-agent]', {
      event,
      payload,
      timestamp: new Date().toISOString()
    });
  }
}
