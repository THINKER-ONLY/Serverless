module.exports = function(req, query) {
  const cities = {
    '北京': { temp: '20°C', condition: '晴' },
    '上海': { temp: '22°C', condition: '多云' },
    '广州': { temp: '28°C', condition: '小雨' },
    '深圳': { temp: '26°C', condition: '阴' },
    '杭州': { temp: '21°C', condition: '晴' }
  };
  
  const city = query.city || '北京';
  const weather = cities[city] || { temp: '未知', condition: '未知' };
  
  return {
    success: true,
    city: city,
    temperature: weather.temp,
    condition: weather.condition,
    timestamp: new Date().toISOString()
  };
};
