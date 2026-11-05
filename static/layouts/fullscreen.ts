
$(".footer_handle").on("click", () => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        $("footer").toggleClass("footer_opened");
    }
})

$(".right_panel_handle").on("click", () => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
        $("right_panel").toggleClass("right_panel_opened");
    }
})
