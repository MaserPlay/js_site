var proj_url = "https://api.github.com/repos/MaserPlay/js_site/contents/content";
$.getJSON( proj_url, function( data ) {
    if (!data){
        $('#list').html("<section class=\"jumbotron text-center\"> <div class=\"container\"> <h1>Its great time, to start coding... <a href=\"https://github.com/MaserPlay\" class=\"link-offset-2 link-underline link-underline-opacity-0 text-primary\">MaserPlay</a></h1> </div> </section>");
    }
    var finish = ""
    $.each(data, function(_d, a){
        finish += "<div class=\"col-md-4\"> <a class=\"link-offset-2 link-underline link-underline-opacity-0 btn btn-warning\" id=\"elem\" href=\"/" + a.path + "\"> <div class=\"mb-4\"> <h2  > " + a.name + " </h2> </div> </a> </div> ";
        $('#list').html(finish);
        //$('#elem').fadeTo( 800 , 1)
    });
  }).fail(function(d) {
    $('#list').html("<section class=\"jumbotron text-center\"> <div class=\"container\"> <h1>Its time, to fix <span class=\"text-danger\"> errors</span>... <a href=\"https://github.com/MaserPlay\" class=\"link-offset-2 link-underline link-underline-opacity-0 text-primary\">MaserPlay</a></h1> </div> </section>");
});

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
$('#theme-' + getTheme()).addClass("active")
$('#theme-change').removeClass("bi-patch-question-fill")
switch (getTheme()) {
  case 'light':
    $('#theme-change').addClass("bi-sun-fill");
    break;
  case 'dark':
    $('#theme-change').addClass("bi-moon-fill");
    break;
  default:
    console.error("cannot find " + getTheme() + "in this")
    $('#theme-change').addClass("bi-patch-question-fill");
    break;
}