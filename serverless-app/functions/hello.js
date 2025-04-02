module.exports = function(req, query) {
  return {
    success: true,
    message: "你好，世界！",
    timestamp: new Date().toISOString(),
    query: query
  };
};
