import { Request, Response, NextFunction } from 'express';
import * as config from '../config';
import * as content from './content_class'
import { format } from 'util';
/**
* Returns a random number between min (inclusive) and max (exclusive)
*/
function getRandomArbitrary(min : number, max : number) {
  return Math.random() * (max - min) + min;
}
/**
 * Returns a random integer between min (inclusive) and max (inclusive).
 * The value is no lower than min (or the next integer greater than min
 * if min isn't an integer) and no greater than max (or the next integer
 * lower than max if max isn't an integer).
 * Using Math.round() will give you a non-uniform distribution!
 */
function getRandomInt(min : number, max : number) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export default function (request : Request, response : Response, next : NextFunction) {
  if (request.cookies.lang&&request.cookies.lang==="auto_locale")
  {
    delete request.cookies["lang"]
  }
  // response.getTheme = function () {
  //   return request.cookies.theme ?? config.json.themes[0]
  // }
  Object.assign(response.locals, {
    theme: function () {
      return request.cookies.theme ?? config.json.themes[0]
    },
    js_include: function (script_name : string) {
      if (request.query.hasOwnProperty("nomini")) {
        return script_name + ".js";
      } else {
        return script_name + ".min.js";
      }
    },
    css_include: function (style_name : string) {
      if (request.query.hasOwnProperty("nomini")) {
        return style_name + ".css";
      } else {
        return style_name + ".min.css";
      }
    },
    lang: function () {
      return request.cookies.lang
    },
    themes: function () {
      return config.json.themes
    },
    event: function () {
      return config.getEvents()[0]
    },
    eventGoingSnow: function () { return config.IsEventGoing("snow") },
    useAd: function () {
      return !request.query.hasOwnProperty("noad")
    },
    userAgent: function () {
      return request.headers["user-agent"]!
    },
    pageStyle: function () {
      return content.Style
    },
    format: format
  });
  return next()
}