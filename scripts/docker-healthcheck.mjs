const port = process.env.PORT ?? '3000';
const url = `http://127.0.0.1:${port}/api/v1/health`;

fetch(url)
  .then((response) => {
    process.exit(response.ok ? 0 : 1);
  })
  .catch(() => {
    process.exit(1);
  });
