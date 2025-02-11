(()=>{
var elem = $('#sn');
var x1 = elem.offset().left,
  y1 = elem.offset().top;
var r = 10,
  x, y, isProcessed = false;
$('html').mousemove(function(e) {
  if (!isProcessed) {
    isProcessed = true;
    var x2 = e.pageX,
      y2 = e.pageY;
    y = ((r * (y2 - y1)) / Math.sqrt((x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1))) + y1;
    x = (((y - y1) * (x2 - x1)) / (y2 - y1)) + x1;
    elem.css({
        transform: `rotateX(${-(y - y1 + 1)}deg) rotateY(${(x - x1)}deg)`
    });
    isProcessed = false;
  }
});
})()