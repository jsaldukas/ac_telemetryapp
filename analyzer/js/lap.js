var Lap = function () {
	function loadLapData(url) {
		// time_ms,car_id,pos_x,pos_y,pos_z,velocity_x,velocity_y,velocity_z,gear,engine_rpm,normalized_spline_pos
		return $.ajax({
			url: url,
			method: 'GET'
		}).then(function (data) {
			var rows = data.split("\r\n");
			var lapFrames = [];
			var header = rows[0].split(',');
			for(var i = 1; i < rows.length; i++) {
				var cols = rows[i].split(',');
				if(cols.length <= 1)
					continue;
				var lapFrame = {};
				for(var j = 0; j < cols.length; j++) {
					var value = cols[j];
					var floatValue = parseFloat(value);
					if(!isNaN(floatValue))
						value = floatValue;
					lapFrame[header[j]] = value;
				}
				lapFrames.push(lapFrame);
			}
			
			normalizeFieldNames(lapFrames);
			adjustLapTime(lapFrames);
			
			return lapFrames;
		});
    }

	function normalizeFieldNames(lap) {
		lap.forEach(function (frame) { 
			if(frame.lapTimeMs) frame.time_ms = frame.lapTimeMs;
			if(frame.trackPosition) frame.normalized_spline_pos = frame.trackPosition;
		});
	}
	
	function adjustLapTime(lap) {
		var minTimeMs = lap[0].time_ms;
		lap.forEach(function (frame) { 
			frame.time_ms -= minTimeMs;
		});
	}
	
	return {
		loadAsync: loadLapData
	};
}();