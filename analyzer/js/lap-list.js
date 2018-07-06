var LapList = {
    loadAsync: function () {
        var url = "/laps";
        return $.ajax({
            url: url,
            method: 'GET'
        }).then(function (html) {
            var hrefSplits = html.split(/<a href="\/laps\//);
            hrefSplits.splice(0, 1);
            var lapFiles = hrefSplits
                .map(function (hrefAndHtml) {
                    var closingQuoteIndex = hrefAndHtml.indexOf("\"");
                    return hrefAndHtml.substr(0, closingQuoteIndex);
                })
                .filter(function (href) { 
                    return href.toLowerCase().endsWith(".csv");
                });
            
            var laps = lapFiles.map(function (lapFile) {
                // example value "2018-07-01-21-00-40__bikernieki_oval__porsche_993_gt_evo_2__2__00m49.640s"
                var filenameWithoutExtension = lapFile.substr(0, lapFile.length - 4);
                var parts = filenameWithoutExtension.split("__");
                
                var datetime = moment(parts[0], "YYYY-MM-DD-HH-mm-ss");
                var track = parts[1];
                var car = parts[2];
                var lap = parseInt(parts[3]);
                var lapTime = parts[4] ? moment.duration(parts[4].replace("m", ":")) : null;

                return {
                    url: "/laps/" + lapFile,
                    track: track,
                    car: car,
                    lap: lap,
                    datetime: datetime
                };
            });
            
            return laps;
        });
    }
};