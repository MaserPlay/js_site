var proj_url = "https://api.github.com/repos/MaserPlay/js_site/contents/content";
$.getJSON( proj_url, function( data ) {
    if (!data){
        $('#list').html("<section class=\"jumbotron text-center\"> <div class=\"container\"> <h1>Its great time, to start coding... <a href=\"https://github.com/MaserPlay\" class=\"link-offset-2 link-underline link-underline-opacity-0 text-primary\">MaserPlay</a></h1> </div> </section>");
    }
    var finish = ""
    $.each(data, function(d, a){
        $('#list').html(finish + "<div class=\"col-md-4\"> <a class=\"link-offset-2 link-underline link-underline-opacity-0 btn btn-warning\" id=\"elem\" style=\"opacity: 0;\" href=\"/" + a.path + "\"> <div class=\"mb-4\"> <h2  > " + a.name + " </h2> </div> </a> </div> ");
        $('#elem').fadeTo( 800 , 1)
    });
  }).fail(function(d) {
    $('#list').html("<section class=\"jumbotron text-center\"> <div class=\"container\"> <h1>Its time, to fix <span class=\"text-danger\"> errors</span>... <a href=\"https://github.com/MaserPlay\" class=\"link-offset-2 link-underline link-underline-opacity-0 text-primary\">MaserPlay</a></h1> </div> </section>");
});
