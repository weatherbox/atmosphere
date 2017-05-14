/*
 * @class L.Atmosphere
 * @inherits L.Class
 * @author Yuta Tachibana
 *
 * for leaflet v1.0
 *
 * requirements:
* 
*/

L.Atmosphere = L.Class.extend({
	options: {
		tileJson: "//d26w2s8b1vy47b.cloudfront.net/tiles/tile.json"
	},

	initialize: function (map, options) {
		this._map = map;
		L.setOptions(this, options);

		var self = this;
		this._getTileJson(function (data) {
			self.data = data;

			// init time
			var valid_time = data.surface.valid_time;
			self.start_time = self.utc(valid_time[0]);
			self.end_time = self.utc(valid_time[valid_time.length - 1]);

			// show last o-clock
			var now = Math.floor(Date.now() / (3600 * 1000)) * 3600 * 1000;
			self.time = Math.max(self.start_time, Math.min(self.end_time, now));
			console.log(self.dateString(self.time));

			// init layers
			self._initMask("APCP", "surface");
			self._initStreamline("surface");
			self._initContour("PRMSL", "surface");
		});

		// set click event
		map.on("click", this.showPointValue, this);
	},
	

	_initGrib2tile: function (element, level){
		var url = this.data.url
			.replace("http:", "")
			.replace("{valid_time}", this.dateString(this.time))
			.replace("{level}", level);
		if (element != "wind") url = url.replace("{e}", element);

		var tileZoom = (level == "surface") ? [0, 1] : [0];
		return new L.Grib2tile(url, element, { tileZoom: tileZoom });
	},

	_initContour: function (element, level){
		this._contourGrib = this._initGrib2tile(element, level);

		this._contour = new L.Contour(this._contourGrib);
		this._contour.addTo(this._map);
	},

	_initStreamline: function (level){
		var self = this;
		this._windGrib = this._initGrib2tile("wind", level);

		this._streamline = new L.Streamline(this._windGrib, {
			//onUpdate: window.windmapUI.showLoading,
			onUpdated: function () {
				//	window.windmapUI.hideLoading();
				if (self._pointMarker) self.updatePointValue();
			}
		});

		if (this._maskGrib){
			this._streamline.setMaskData(this._maskGrib, this._mask_color);
		}

		this._streamline.addTo(this._map);
	},

	_initMask: function (element, level){
		this._maskGrib = this._initGrib2tile(element, level);
		this._mask_color = this._maskColor(element);
	},

	_updateWindGrib: function (){
		this._windGrib.abort();
		this._windGrib = this._initGrib2tile();
		this._streamline.setWindData(this._windGrib);
	},

	_updateMaskGrib: function (){
		this._maskGrib.abort();
		this._maskGrib = this._initGrib2tile(this.element);
		this._streamline.setMaskData(this._maskGrib, this._maskColor(this.element));
	},

	_update: function (){
		this._updateWindGrib();
		if (this._maskGrib) this._updateMaskGrib();
		this._streamline._update();
	},
	
	_getTileJson: function (callback) {
		$.getJSON(this.options.tileJson, function (data) {
			callback(data);
		});
	},


	/*
	 * PointValue - marker on map
     *
	 */
	showPointValue: function (e) {
		var latlng = e.latlng;

		var wind = this._windGrib.getVector(latlng);
		var rain = this._maskGrib.getValue(latlng);
		var pres = this._contourGrib.getValue(latlng);
		if (wind[0] != null) this._initPointValue(wind, rain, pres, latlng);
	},

	updatePointValue: function () {
		var latlng = this._pointMarker.getLatLng();

		var wind = this._windGrib.getVector(latlng);
		var rain = this._maskGrib.getValue(latlng);
		var pres = this._contourGrib.getValue(latlng);
		if (wind[0] != null) this._updatePointValue(wind, rain, pres, latlng);
	},

	_updatePointValue: function (wind, rain, pres, latlng) {
		var icon = this._createPointIcon(wind, rain, pres);
		this._pointMarker.setIcon(icon);
	},

	_pointText: function (v, element) {
		if (element == "wind"){
			var speed = Math.sqrt(v[0]*v[0] + v[1]*v[1]);
			var ang = Math.acos(v[1] / speed) / Math.PI * 180 + 180;
			if (v[0] < 0) ang = 360 - ang;

			return Math.round(ang) + "° "  + speed.toFixed(1) + "m/s";

		}else if (element == "TMP"){
			return (v - 273.15).toFixed(1) + "℃";

		}else if (element == "TCDC"){
			return v.toFixed(0) + "%";

		}else if (element == "APCP"){
			return v.toFixed(1) + "mm/h";

		}else if (element == "PRMSL"){
			return (v / 100).toFixed(0) + "hPa";

		}else{
			return v.toFixed(1);
		}
	},

	_initPointValue: function (wind, rain, pres, latlng){
		var icon = this._createPointIcon(wind, rain, pres);

		if (this._pointMarker) {
			this._pointMarker.setLatLng(latlng);
			this._pointMarker.setIcon(icon);

		}else{
			this._pointMarker = L.marker(
				latlng, 
				{ icon:icon, draggable:true }
			).addTo(this._map);

			this._pointMarker.on('dragend', this.updatePointValue, this);
			//this._pointMarker.on('click', this.showPointDetail, this);
		}
	},
	
	_createPointIcon: function (wind, rain, pres) {
		var text1 = this._pointText(wind, "wind");
		var text2 = this._pointText(rain, "APCP");
		var text3 = this._pointText(pres, "PRMSL");

		return new L.divIcon({
			iconSize: [10, 80],
			iconAnchor: [0, 80],
			className: 'leaflet-point-icon',
			html: '<div class="point-flag">' +
				'<a class="flag-text" id="flag-text">' + 
				text1 + '<br/>' +
				text2 + '<br/>' +
				text3 + '<br/>' +
				'</a>' +
				'<div class="flag-pole"></div>' +
				'<div class="flag-draggable-square"></div>' +
				'<div class="flag-anchor"></div>' +
				'</div>'
		});
	},

	showPointDetail: function (e){
		var ep = e.originalEvent;
		var p = this._pointMarker.getLatLng();
		var pp = this._map.latLngToLayerPoint(p);

		// check click point (avoid double click zooming)
		if (Math.abs(ep.x - pp.x) > 10 || Math.abs(ep.y - pp.y) > 10){
			window.windmapUI.showPointDetail(p.lat, p.lng);
		}
	},
	
	hidePointValue: function() {
		if (this._pointMarker) this._map.removeLayer(this._pointMarker);
		this._pointMarker = null;
	},

	utc: function (dateString){
		return Date.UTC(
			dateString.substr(0, 4),
			dateString.substr(4, 2) - 1,
			dateString.substr(6, 2),
			dateString.substr(8, 2),
			dateString.substr(10, 2)
		);
	},

	dateString: function (utc){
		let date = new Date(utc);
		let year = date.getUTCFullYear();
		let MM = ('0' + (date.getUTCMonth() + 1)).slice(-2);
		let dd = ('0' + date.getUTCDate()).slice(-2);
		let hh = ('0' + date.getUTCHours()).slice(-2);
		let mm = ('0' + date.getUTCMinutes()).slice(-2);
		return year + MM + dd + hh + mm
	},

	_maskColor: function (element){
		// function (v) -> return [R, G, B, A]
		let MASK_ALPHA = Streamline.prototype.MASK_ALPHA;

		if (element == 'TMP'){  // temperture
			let tempColorScale = SegmentedColorScale([
				[193,     [37, 4, 42]],
				[206,     [41, 10, 130]],
				[219,     [81, 40, 40]],
				[233.15,  [192, 37, 149]],  // -40 C/F
				[255.372, [70, 215, 215]],  // 0 F
				[273.15,  [21, 84, 187]],   // 0 C
				[275.15,  [24, 132, 14]],   // just above 0 C
				[291,     [247, 251, 59]],
				[298,     [235, 167, 21]],
				[311,     [230, 71, 39]],
				[328,     [88, 27, 67]]
			]);

			return function (v){
				return tempColorScale(v, MASK_ALPHA);
			}

		}else if (element == 'TCDC'){  // total cloud cover
			let cloudColorScale = chroma.scale(['black', 'white']).domain([0,100]);

			return function (v){
				let c = cloudColorScale(v).rgb();
				let alpha = MASK_ALPHA * v / 100;
				return [c[0], c[1], c[2], alpha];
			}

		}else if (element == 'APCP'){  // rain
			let rainColorScale = chroma.scale(['008ae5', 'yellow', '#fa0080'])
    			.domain([0, 0.3, 1])
				.mode('lch');

			return function (v){
				let c = rainColorScale(Math.min(v / 100, 1)).rgb();
				let alpha = (v < 0.1) ? 0 : (v < 1) ? MASK_ALPHA * v : MASK_ALPHA;
				return [c[0], c[1], c[2], alpha];
			}

		}else if (element == 'PRMSL'){  // pressure
			let presColorScale = chroma.scale('RdYlBu').domain([1,0]);

			return function (v){
				let vh = (v / 100).toFixed(0); // quantize 1hPa
				let vd = Math.min(Math.max((vh - 993)/40, 0), 1)
				let c = presColorScale(vd).rgb();
				return [c[0], c[1], c[2], MASK_ALPHA];
			}
		}
	}

});

