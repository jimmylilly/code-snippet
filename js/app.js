/* OSD Pane Info Application
 **************************************************/
let g_paneinfo;
let PaneInfoApp = function() {
    let self = this;

    let signageLoaderID = 0;        // Timer ID of signageLoader.
    let signRefresherID = 0;        // Timer ID of signRefresher.

    let now_loading_sign = false;

    let config = {}

    // Snapshot of last sign load
    let monitor = {
        last_report: null,              // Date of last monitoring
        name: "",                       // Sign Name
        panes: []
    }

    let pane_templ = {
        name: "",                       // Pane Name
        content: {
            type: "",                   // Video, Audio, Graphic, Text, Playlist, Unknown
            filename: "",               // Strip beginning /assets
            duration: 0,
            elapsed: 0,
            remaining: 0
        }
    }


    /* ::: Initialize
     **************************************************/
    let initialize = function() {
        signageLoader();                                        // First load of Signage Report

        signRefresherID = setInterval(signRefresher, 1000);     // Refresh from snapshot monitor
    } // END: initialize

    // Standard ajax Error
    ajaxError = function(json, textStatus, xmlHttpRequest) {
        if( textStatus == null ) {
            textStatus = "unknown";
        }
        let errmsg = textStatus +": json => "+ JSON.stringify(json) + " ... request => " + JSON.stringify(xmlHttpRequest);
        debug("AJAX-ERROR", errmsg);

        $('#loading').hide();
        now_loading_sign = false;
    }


    /* ::: Sign Monitor
     **************************************************/

    // Build Sign Monitor + HTML
    let buildSign = function(db_sign) {
        $('#sign').find('.sign_name').html(db_sign.sign);
        $('#sign tr.pane').remove();

        // Create monitor values
        monitor.name = db_sign.sign;
        monitor.panes = [];
        for( let i=db_sign.panes.length-1; i>-1; i-- ) {                // Reverse Order
            let db_pane = db_sign.panes[i];
            let new_pane = $.extend(true, {}, pane_templ);          // Deep copy

            new_pane.name = db_pane.name;

            monitor.panes.push(new_pane);

            // Create HTML
            let tr = $('#pane_templ tr').clone().appendTo('#sign');
            tr.data({
                pane_name: db_pane.name
            }).find('.pane_name').html(db_pane.name);
            $('#sign').append(tr);
        }
    }

    // Load Signage Loop
    let signageLoader = function() {
        if( signageLoaderID > 0 ) {
            clearInterval(signageLoaderID);
            signageLoaderID = 0;
        }

        loadSign();   // First call
        signageLoaderID = setInterval(loadSign, config.signage_polltime);
    }

    // Simulate progress (interpolate) based on last monitor
    let signRefresher = function() {
        if( monitor.last_report === null ) {
            return;
        }
        if( now_loading_sign == true ) {
            return;
        }
        if( monitor.panes.length == 0 ) {
            return;
        }

        let now = new Date();
        let gap_from_last = now.getTime() - monitor.last_report.getTime();

        // Update HTML values from monitor
        let force_reload = false;
        $('#sign tr.pane').each(function() {
            let pane_name = $(this).data('pane_name');

            // Find Monitored pane snapshot
            let mon_pane = null;
            for( let i=0; i<monitor.panes.length; i++ ) {
                if( monitor.panes[i].name == pane_name ) {
                    mon_pane = monitor.panes[i];
                    break;
                }
            }
            if( mon_pane === null ) {
                return true;
            }

            let elapsed_msecs = mon_pane.content.elapsed + gap_from_last;
            let remaining_msecs = mon_pane.content.remaining - gap_from_last;

            if( elapsed_msecs > mon_pane.content.duration ) {           // Content finished playing
                elapsed_msecs = mon_pane.content.duration;
                force_reload = true;
            }

            let display = {
                filename: "Type: "+ mon_pane.content.type,
                duration: "",
                elapsed: "",
                remaining: ""
            }
            // ONLY report Video progress ...
            if( mon_pane.content.type == 'Video' ) {
                display.filename = mon_pane.content.filename;
                display.duration = prettyTime(mon_pane.content.duration);
                display.elapsed = prettyTime(elapsed_msecs);
                display.remaining = prettyTime(remaining_msecs);
            }

            $(this).find('.filename').html(display.filename);
            $(this).find('.duration').html(display.duration);
            $(this).find('.elapsed').html(display.elapsed);
            $(this).find('.remaining').html(display.remaining);
        });
        if( force_reload == true ) {
            signageLoader();        // Restart Signage Loader
        }
    }

    // Display time in H:MM:SS or M:SS format.
    let prettyTime = function(msecs) {
        let time = "";

        if( isNaN(msecs) ) {
            msecs = 0;
        }
        if( msecs < 0 ) {
            msecs = 0;
        }

        let seconds = msecs / 1000;
        let hrs = Math.floor(seconds/60/60);            // Integer
        let mins = Math.floor((seconds/60)%60);         // Integer
        let secs = Math.floor(seconds%60);              // Integer

        if( secs < 10 ) { secs = "0"+ secs; }

        if( hrs > 0 ) {
            if( mins < 10 ) { mins = "0"+ mins; }
            time = hrs +":"+ mins +":"+ secs;
        }
        else {
            time = mins +":"+ secs;
        }

        return time;
    }


    /* ::: CGI Handlers
     **************************************************/

    // Log a debug message
    debug = function(section, message) {
        if( config.debug == false ) {
            return;
        }

        let param_str = section +"|"+ message;
        $.ajax('api/debugger.cgi', {
            timeout: config.cgi_timeout,
            type: 'POST',
            data: param_str,
            async: true,        // false = Wait for response
            success: _debug,
            error: function(json, textStatus, xmlHttpRequest) {
                // cgi error
            }
        });
    }
    // Callback
    let _debug = function(json, textStatus, xmlHttpRequest) {
        if( json.success == false ) {
            // debug error
        }
    }

    // Get what sign is currently playing
    let loadSign = function() {
        $('#loading').show();
        now_loading_sign = true;

        $.ajax('api/signage.cgi', {
            timeout: config.cgi_timeout,
            type: 'GET',
            async: true,        // false = Wait for response
            success: _loadSign,
            error: ajaxError
        });
    }
    // Callback
    let _loadSign = function(json, textStatus, xmlHttpRequest) {
        let db_sign;
        let mon_idx;

        if( json.length > 0 ) {
            db_sign = json[0];
        }
        else {
            db_sign = {
                sign: "",
                panes: []
            }
        }

        // Check if sign has changed ...
        let changed = false;
        if( db_sign.panes.length == 0 && monitor.panes.length > 0 ) {
            changed = true;
            if( db_sign.sign == "" ) {
                console.info("Sign has stopped.");
            }
            else {
                console.info("Last monitored sign had panes but this sign has 0 panes.");
            }
        }
        else {
            if( db_sign.sign != monitor.name ) {
                changed = true;
                if( monitor.name == "" ) {
                    console.info("New sign starting.");
                }
                else {
                    console.info("Sign name changed.");
                }
            }
            else {
                // Assume panes are in `panes_signs`.`pane_order` order.
                mon_idx = 0;
                for( let i=db_sign.panes.length-1; i>-1; i-- ) {        // Reverse Order
                    let db_pane = db_sign.panes[i];

                    if( db_pane.name != monitor.panes[mon_idx].name ) {
                        changed = true;
                        console.info("Pane name changed / out of order.");
                        break;
                    }

                    mon_idx++;
                }
            }
        }
        if( changed == true ) {
            buildSign(db_sign);
        }

        // Update monitor values
        mon_idx = 0;
        for( let i=db_sign.panes.length-1; i>-1; i-- ) {                // Reverse Order
            let db_pane = db_sign.panes[i];

            // PaneSeq attributes
            let ps_element = db_pane.sequence.element;
            let ps_state = db_pane.sequence.state;

            monitor.panes[mon_idx].content.type = ps_element.asset.type;
            monitor.panes[mon_idx].content.filename = ps_element.asset.asset;
            if( ps_element.asset.asset.substr(0,7) == '/assets' ) {
                monitor.panes[mon_idx].content.filename = ps_element.asset.asset.substr(7);
            }
            monitor.panes[mon_idx].content.duration = ps_state.duration;
            monitor.panes[mon_idx].content.elapsed = ps_state.elapsed;
            monitor.panes[mon_idx].content.remaining = ps_state.remaining;

            mon_idx++;
        }

        monitor.last_report = new Date();

        $('#loading').fadeOut(1000);
        now_loading_sign = false;
    }


    /* ::: Startup
     **************************************************/

    // Load Configuration, then initialize
    $.getJSON('config.json', function(json) {
        config = json;

        initialize();
    });
}
PaneInfoApp.prototype.constructor = PaneInfoApp;

// Start the Application Engine
$(document).ready(function() {
    g_paneinfo = new PaneInfoApp();
});
