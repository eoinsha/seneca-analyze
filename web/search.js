var addSearchSupport = function() {
    $(window).keydown(function (e) {
        if ((e.ctrlKey || e.metaKey) && e.keyCode === 70) {
            toggleSearch();
            e.preventDefault()
        }
    });

}

var hideSearch = function() {
    $('#search').hide()
}

var showSearch = function() {
    $('#search').show()
    $('#searchBox').focus().select()
}

var toggleSearch = function() {
    if($('#search').is(':visible')) {
        hideSearch()
    }
    else {
        showSearch();
    }
}

$(document).ready(function() {
    addSearchSupport()

    $('#searchBox').on('input', function() {
        applyFilter($(this).val())
    })

    $('#searchBox').keyup(function(e) {
        if(e.keyCode == 27) {
            $(this).val('').change()
            hideSearch()
        }
    })
})
