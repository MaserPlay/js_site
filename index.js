var proj_url = "https://api.github.com/repos/MaserPlay/js_site/contents/content";
$.getJSON( proj_url, function( data ) {
    console.log(data)
    if (!data){
        return
    }
    var finish = ""
    $.each(data, function(d, a){
        console.log(a)
        finish = finish + "<div class=\"col-md-4\"> <a class=\"link-offset-2 link-underline link-underline-opacity-0\" href=/\"/content/" + a.path + "\"> <div class=\"card mb-4 shadow-sm\"> <h2 class=\"card-title\"> " + a.name + " </h2> </div> </a> </div> ";
    });
    $('#list').html(finish);
  }).fail(function(d) {
    $('#list').html("<section class=\"jumbotron text-center\"> <div class=\"container\"> <h1>Its time, to fix <span class=\"text-danger\"> errors</span>... <a href=\"https://github.com/MaserPlay\" class=\"link-offset-2 link-underline link-underline-opacity-0 text-primary\">MaserPlay</a></h1> </div> </section>");
});
