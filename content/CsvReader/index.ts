(() => {
  function escapeHtml(str: string): string {
    return str.replace(/[&<>"']/g, (c) => {
      switch (c) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case '"': return "&quot;";
        case "'": return "&#39;";
        default: return c;
      }
    });
  }

  function calc(csv: string): void {
    const separator = ($("#input_sep").val() as string) ?? ",";

    const rows = csv.split("\n");
    let html = "";

    for (const row of rows) {
      const columns = row.split(separator);

      html += "<tr>";

      for (const column of columns) {
        html += `<td>${escapeHtml(column.trim())}</td>`;
      }

      html += "</tr>";
    }

    $("#table_body").html(html);
  }

  $("#csv_input").on("change", function () {
    const input = this as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = () => {
      calc(reader.result as string);
      input.value = "";
    };

    reader.readAsText(file);
  });
})()