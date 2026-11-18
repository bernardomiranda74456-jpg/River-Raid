// Permite publicar a versão web em um subcaminho (ex.: GitHub Pages em /River-Raid/ritmo)
// sem alterar o app.json: EXPO_WEB_BASE_URL=/River-Raid/ritmo npx expo export --platform web
const base = require('./app.json');

module.exports = () => {
  const expo = { ...base.expo };
  const webBase = process.env.EXPO_WEB_BASE_URL;
  if (webBase) {
    expo.experiments = { ...(expo.experiments ?? {}), baseUrl: webBase };
  }
  return { expo };
};
