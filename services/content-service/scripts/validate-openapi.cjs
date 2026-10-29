const SwaggerParser = require('@apidevtools/swagger-parser');
const path = require('node:path');
SwaggerParser.validate(path.resolve(__dirname, '../../../docs/openapi/content-service.json'))
  .then(() => console.log('content-service OpenAPI is valid'))
  .catch(error => { console.error(error.message); process.exitCode = 1; });
