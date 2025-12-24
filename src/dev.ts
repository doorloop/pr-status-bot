import app from './app';

const start = async () => {
  try {
    await app.listen({ port: 3000, host: '0.0.0.0' });
    console.log('Server running at http://localhost:3000');
    console.log('Slack command endpoint: http://localhost:3000/slack/command');
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
