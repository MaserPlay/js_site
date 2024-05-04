$(document).ready(function () {
    const datatypes = { CHAR: "char", NUMBER: "number"};
    const CppDataTypes = [
        {
            byte: 1,
            datatype: datatypes.CHAR,
            val: "signed char"
        },{
            byte: 1,
            datatype: datatypes.CHAR,
            val: "unsigned char"
        },{
            byte: 1,
            datatype: datatypes.CHAR,
            val: "Char"
        },{
            byte: 2,
            datatype: datatypes.NUMBER,
            val: "short"
        },{
            byte: 2,
            datatype: datatypes.NUMBER,
            val: "unsigned short"
        },{
            byte: 2,
            datatype: datatypes.NUMBER,
            val: "int"
        },{
            byte: 2,
            datatype: datatypes.NUMBER,
            val: "unsigned int"
        },{
            byte: 4,
            datatype: datatypes.NUMBER,
            val: "long"
        },{
            byte: 4,
            datatype: datatypes.NUMBER,
            val: "unsigned long"
        },{
            byte: 8,
            datatype: datatypes.NUMBER,
            val: "long long"
        },{
            byte: 8,
            datatype: datatypes.NUMBER,
            val: "unsigned long long"
        }
    ]
    $("#btn").click(function () {
        var B = $("#bytes").val()
        var sel = $("#sel").val()
        if (sel == "Nothing selected")
            {
                $("#sel").addClass("is-invalid")
                return
            } else {
                $("#sel").removeClass("is-invalid")
            }
        $("#answer").html("Nothing was found")
        CppDataTypes.forEach((element) => {
            if (element.byte <= Number(B) && sel.toString() == element.datatype){
                $("#answer").html(element.val)
            }
        });
         
    });
});