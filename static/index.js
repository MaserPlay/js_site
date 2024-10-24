$('.scChngThm').on('click', function () {
    document.cookie=`theme=${$(this).attr("val")};path=/`; document.location.reload()
    return false;
});
function getCookie(name) {
    let cookie = document.cookie.split('; ').find(row => row.startsWith(name + '='));
    return cookie ? cookie.split('=')[1] : null;
  }
function getTheme(){
    return getCookie("theme") ?? "light";
}
  
$('body,html').attr("data-bs-theme", getTheme())
$(`#theme-${getTheme()}`).addClass("active")
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
Object.defineProperty(String.prototype, 'capitalize', {
  value: function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
  },
  enumerable: false
});