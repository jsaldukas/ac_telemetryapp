function loadLapData(url) {
	// car_id,pos_x,pos_y,pos_z,velocity_x,velocity_y,velocity_z,gear,engine_rpm,normalized_spline_pos
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
		return lapFrames;
	});
}

function calculateLapRect(lapData) {
	var minX = 999999, maxX = -999999, minZ = 999999, maxZ = -999999;
	for(var i = 0; i < lapData.length; i++) {
		var lapFrame = lapData[i];
		if(lapFrame.pos_x < minX) minX = lapFrame.pos_x;
		if(lapFrame.pos_x > maxX) maxX = lapFrame.pos_x;
		if(lapFrame.pos_z < minZ) minZ = lapFrame.pos_z;
		if(lapFrame.pos_z > maxZ) maxZ = lapFrame.pos_z;
	}
	
	return {
		minX: minX,
		maxZ: maxZ,
		maxX: maxX,
		minZ: minZ
	};
}

function getLapToCanvasCoordTransform(lapDataList, canvasWidth, canvasHeight) {
	var minScale = 999999;
	var minOffsetX = 999999;
	var minOffsetZ = 999999;
	var canvasSize = canvasHeight > canvasWidth ? canvasWidth : canvasHeight;
	for(var i = 0; i < lapDataList.length; i++) {
		var lapData = lapDataList[i];
		var lapRect = calculateLapRect(lapData);
		var scaleX = canvasSize / (lapRect.maxX - lapRect.minX);
		var scaleZ = canvasSize / (lapRect.maxZ - lapRect.minZ);
		var scale = scaleX > scaleZ ? scaleZ : scaleX;
		var offsetX = -lapRect.minX;
		var offsetZ = -lapRect.minZ;
		
		if(scale < minScale) minScale = scale;
		if(offsetX < minOffsetX) minOffsetX = offsetX;
		if(offsetZ < minOffsetZ) minOffsetZ = offsetZ;
	}
	
	return {
		scale: minScale,
		offsetX: minOffsetX,
		offsetZ: minOffsetZ
	};
}

function setLapCanvasCoordinates(lapData, canvasSize) {
	var lapRect = calculateLapRect(lapData);
	var scaleX = canvasSize / (lapRect.maxX - lapRect.minX);
	var scaleZ = canvasSize / (lapRect.maxZ - lapRect.minZ);
	var scale = scaleX > scaleZ ? scaleZ : scaleX;
	var offsetX = -lapRect.minX;
	var offsetZ = -lapRect.minZ;
	for(var i = 0; i < lapData.length; i++) {
		var lapFrame = lapData[i];
		lapFrame.canvas_x = (lapFrame.pos_x + offsetX) * scale;
		lapFrame.canvas_y = (lapFrame.pos_z + offsetZ) * scale;
	}
}

function drawLap(ctx, lapData, coordTransform, color) {
	function getCanvasX(pos_x, coordTransform) {
		return (coordTransform.offsetX + pos_x) * coordTransform.scale;
	}
	function getCanvasY(pos_z, coordTransform) {
		return (coordTransform.offsetZ + pos_z) * coordTransform.scale;
	}
	
	ctx.beginPath();
	
	if(color) {
		ctx.strokeStyle = color;
	}
	
	ctx.lineWidth = 1;
	
	ctx.moveTo(getCanvasX(lapData[0].pos_x, coordTransform), getCanvasY(lapData[0].pos_z, coordTransform));
	
	for(var i = 0; i < lapData.length; i++) {
		ctx.lineTo(getCanvasX(lapData[i].pos_x, coordTransform), getCanvasY(lapData[i].pos_z, coordTransform));
	}
	
	ctx.closePath();
	ctx.stroke();
	
	ctx.restore();
}



function loadLapComparison(lapUrl1, lapUrl2) {
	loadLapData(lapUrl1).then(function (lapData1) {
		loadLapData(lapUrl2).then(function (lapData2) {
			var myCanvas = $('#myCanvas')[0]; 
			var width = myCanvas.width;
			var height = myCanvas.height;
			var coordTransform = getLapToCanvasCoordTransform([lapData1, lapData2], width, height);
			
			window.requestAnimationFrame(function () {
				var ctx = myCanvas.getContext('2d');
				ctx.clearRect(0, 0, width, height);
				drawLap(ctx, lapData1, coordTransform, 'grey');
				drawLap(ctx, lapData2, coordTransform, 'red');
			});
			
		});
	});
}



loadLapComparison('laps/01.29.538_18.csv', 'laps/01.30.094_18.csv');
// loadLapData('laps/01.29.538_18.csv').then(function (lapData) {
	// setLapCanvasCoordinates(lapData, 300, 300);
	// drawLap(lapData);
// });

// loadLapData('laps/01.29.538_18.csv').then(function (lapData) {
	// setLapCanvasCoordinates(lapData, 300, 300);
	// drawLap(lapData);
// });