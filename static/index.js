String.prototype.capitalize = String.prototype.capitalize || function () {
  return this.charAt(0).toUpperCase() + this.slice(1);
}
String.prototype.format = String.prototype.format ||
  function () {
    var args = Array.prototype.slice.call(arguments);
    var replacer = function (a) { return args[a.substr(1) - 1]; };
    return this.replace(/(\$\d+)/gm, replacer)
  };
(() => {
  $('.scChngThm').on('click', function () {
    document.cookie = `theme=${$(this).attr("val")};path=/`; document.location.reload()
    return false;
  });
  $('.scChngLang').on('click', function () {
    document.cookie = `lang=${$(this).attr("val")};path=/`; document.location.reload()
    return false;
  });
  function getCookie(name) {
    var cookie = document.cookie.split('; ').find(row => row.startsWith(name + '='));
    return cookie ? cookie.split('=')[1] : null;
  }
  function getTheme() {
    return getCookie("theme") ?? "light";
  }
  $('#theme-change').removeClass("bi-patch-question-fill")
  switch (getTheme()) {
    case 'light':
      $('#theme-change').addClass("bi-sun-fill");
      break;
    case 'dark':
      $('#theme-change').addClass("bi-moon-fill");
      break;
    default:
      console.error(`cannot find ${getTheme()} in this`)
      $('#theme-change').addClass("bi-patch-question-fill");
      break;
  }
  for (let popover of document.getElementsByClassName("popovers_cls")) {
    new bootstrap.Popover(popover)
  }
})()