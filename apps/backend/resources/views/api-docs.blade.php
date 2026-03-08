<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Eco Delivery Routes - API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
    <style>
      html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        background: #0b1220;
      }
      #swagger-ui {
        height: 100%;
      }
      .topbar { display: none; }
    </style>
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
    <script>
      const specVersion = "{{ filemtime(base_path('openapi.yaml')) }}";
      const noCacheTs = Date.now();
      window.ui = SwaggerUIBundle({
        url: `/openapi.yaml?v=${specVersion}&ts=${noCacheTs}`,
        dom_id: '#swagger-ui',
        deepLinking: true,
        displayRequestDuration: true,
      });
    </script>
  </body>
</html>
