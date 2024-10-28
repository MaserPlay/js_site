/**
 * @param {Express.Request} request
 * @param {Express.Response} response
 * @param {() => void} next
 */

var themeList = ['light', 'dark']

function main(request, response, next) {
  response.getTheme = function (){
    return request.cookies.theme ?? 'light'
  }
  Object.assign(response.locals, {
    theme: response.getTheme, 
    js_include: function (script_name) {
      if (request.query.hasOwnProperty("nomini")) {
        return script_name + ".js";
      } else {
        return script_name + ".min.js";
      }
    },
    css_include: function (style_name) {
      if (request.query.hasOwnProperty("nomini")) {
        return style_name + ".css";
      } else {
        return style_name + ".min.css";
      }
    },
    eachLocale: function () {
      return response.getLocales().map((local) => ({ id: local, displayName: response.__({ phrase: local, locale: local }), active: response.getLocale() === local ? "active" : "" }))
    },
    eachTheme: function () {
      return themeList.map((local) => ({ id: local, displayName: response.__(local), active: response.getTheme() == local ? "active" : "" }))
    },
    event: function () {
      return require("../config").getEvents()[0]
    }
    });
  return next()
}
module.exports = { main: main }