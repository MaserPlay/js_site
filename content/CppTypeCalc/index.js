$(document).ready(function () {
    const datatypes = { CHAR: "char", NUMBER: "number"};
    const CppDataTypes = [
        {
            byte: 1,
            datatype: datatypes.CHAR,
            val: "signed char",
            max_val: 127,
            min_val: -128
        },{
            byte: 1,
            datatype: datatypes.CHAR,
            val: "unsigned char",
            max_val: 255,
            min_val: 0
        },{
            byte: 1,
            datatype: datatypes.CHAR,
            val: "Char",
            max_val: 127,
            min_val: -128
        },{
            byte: 2,
            datatype: datatypes.NUMBER,
            val: "short",
            max_val: 32767,
            min_val: -32768
        },{
            byte: 2,
            datatype: datatypes.NUMBER,
            val: "unsigned short",
            max_val: 65535,
            min_val: 0
        },{
            byte: 2,
            datatype: datatypes.NUMBER,
            val: "int",
            max_val: 32767,
            min_val: -32768
        },{
            byte: 2,
            datatype: datatypes.NUMBER,
            val: "unsigned int",
            max_val: 65535,
            min_val: 0
        },{
            byte: 4,
            datatype: datatypes.NUMBER,
            val: "long",
            max_val: 9223372036854775807,
            min_val: -9223372036854775808
        },{
            byte: 4,
            datatype: datatypes.NUMBER,
            val: "unsigned long",
            max_val: 4294967295,
            min_val: 0
        },{
            byte: 8,
            datatype: datatypes.NUMBER,
            val: "long long",
            max_val: 9223372036854775807,
            min_val: -9223372036854775808
        },{
            byte: 8,
            datatype: datatypes.NUMBER,
            val: "unsigned long long",
            max_val: 18446744073709551615,
            min_val: 0
        }
    ]
    $("#btn").click(function () {
        var B = $("#bytes").val()
        var sel = $("#sel").val()
        var storeto = $("#StoreTo").val()
        var storeup = $("#StoreUp").val()
        if (sel == "Nothing selected")
            {
                $("#sel").addClass("is-invalid")
                return
            } else {
                $("#sel").removeClass("is-invalid")
            }
        $("#answer").html("Nothing was found")
        CppDataTypes.forEach((element) => {
            if (element.byte <= Number(B) && sel.toString() == element.datatype && Number(storeto) <= element.max_val && Number(storeup) >= element.min_val){
                $("#answer").html(element.val)
            }
        });
         
    });
});