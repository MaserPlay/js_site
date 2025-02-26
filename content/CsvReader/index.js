var calc = function (csv) {
  var csvspn = csv.split('\n');
  var finish = '';
  for (var e = 0; e < csvspn.length; ++e) {
    var csvsp = csvspn[e].split($('#input_sep').val());
    finish += '<tr>';
    for (var i = 0; i < csvsp.length; ++i) {
      finish += '<td>' + escapeHtml(csvsp[i].trim()) + '</td>';
    }
    finish += '</tr>';
  }
  $('#table_body').html(finish);
};
// calc(
//   'John,Doe,120 jefferson st.,Riverside, NJ, 08075\nJohn,Doe,120 jefferson st.,Riverside, NJ, 08075'
// );

$('#csv_input').change(function () {
  var fileName = $('#csv_input').prop('files')[0];
  //console.log(fileName);
  var fr = new FileReader();
  fr.onload = function () {
    calc(fr.result);
    $('#csv_input').val(null);
  };
  fr.readAsText(fileName);
});

