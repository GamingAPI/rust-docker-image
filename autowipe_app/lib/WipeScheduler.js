const moment = require('moment');
class WipeScheduler{
	/**
	 * 
	 * @param {int} map_wipe_period days
	 * @param {int} map_wipes_until_full_wipe  times
	 * @param {int} wipe_hour hour
	 * @param {int} wipe_minute minute
	 * @param {boolean} exclude_force_week dont wipe in force week
	 * @param {int} [wipe_day] monday = 0 ... sunday = 7
	 */
	constructor(map_wipe_period, map_wipes_until_full_wipe, wipe_hour, wipe_minute, exclude_force_week, wipe_day){
		this.map_wipe_period = parseInt(map_wipe_period, 10);
		this.map_wipes_until_full_wipe = parseInt(map_wipes_until_full_wipe, 10);
		this.wipe_hour = parseInt(wipe_hour, 10);
		this.wipe_minute = parseInt(wipe_minute, 10);
		this.exclude_force_week = typeof exclude_force_week === "boolean" ? exclude_force_week : (exclude_force_week == 'true');
		this.wipe_day = parseInt(wipe_day, 10);
		console.log(`WipeScheduler:: Initiated with map_wipe_period ${map_wipe_period}`)
		console.log(`WipeScheduler:: Initiated with map_wipes_until_full_wipe ${map_wipes_until_full_wipe}`)
		console.log(`WipeScheduler:: Initiated with wipe_hour ${wipe_hour}`)
		console.log(`WipeScheduler:: Initiated with wipe_minute ${wipe_minute}`)
		console.log(`WipeScheduler:: Initiated with exclude_force_week ${exclude_force_week}`)
		console.log(`WipeScheduler:: Initiated with wipe_day ${wipe_day}`)
	}

	shouldMapWipe(current_date){
		if(this.isForceWeek(current_date)){
			return false;
		}
	
		var current_day_of_year = this.getDayOfYearOfFirstWipe(current_date);
		
		//Check if its day to map wipe
		if(current_day_of_year % this.map_wipe_period === 0){			
			return true;
		}
		return false;
	}

	/**
	 * 
	 * @param {moment.date} current_date 
	 */
	shouldFullWipe(current_date){
		if(this.map_wipes_until_full_wipe === 0){
			return false;
		}
		if(this.isForceWeek(current_date)){
			return false;
		}
	
		var current_day_of_year = this.getDayOfYearOfFirstWipe(current_date);
		
		//Check if its day to full wipe
		if(current_day_of_year % (this.map_wipes_until_full_wipe * this.map_wipe_period) === 0){
			return true;
		}
		return false;
			
	}
	
	getTimeToNextWipe(current_date){
		if(!moment.isMoment(current_date)){
			console.error("Could not get time to next wipe, provided datetime is not a moment object..");
			return;
		}
		var next_wipe_date = current_date.clone();
		next_wipe_date.minute(this.wipe_minute);
		next_wipe_date.hour(this.wipe_hour);
		next_wipe_date.seconds(0);
		next_wipe_date.millisecond(0);
		var time_to_wipe = 0;
		var day_of_week = current_date.isoWeekday();
		
		const exclude_force_week_func = () => {
			if(this.isForceWeek(next_wipe_date)){
				next_wipe_date = next_wipe_date.isoWeekday(next_wipe_date.isoWeekday()+7);
			}
		}

		const move_1_week = () => {
			next_wipe_date = next_wipe_date.isoWeekday(day_of_week+this.map_wipe_period);
			var was_dst = next_wipe_date.isDST();
			if(this.wipe_day !== null){
				next_wipe_date = next_wipe_date.isoWeekday(this.wipe_day);
			}
			exclude_force_week_func();
			if(was_dst && !next_wipe_date.isDST()){
				next_wipe_date.hour(this.wipe_hour);
			}
		}

		if(this.wipe_day !== null){
			if(day_of_week > this.wipe_day || current_date.isAfter(next_wipe_date) ){
				move_1_week(next_wipe_date);
			}else{
				next_wipe_date = next_wipe_date.isoWeekday(this.wipe_day);
				exclude_force_week_func();
			}
		}
		console.log(`WipeScheduler:: Next wipe date is ${next_wipe_date.toString()}`);

		time_to_wipe = next_wipe_date.diff(current_date);
		return time_to_wipe;
	}


	//SUPPORT FUNCTIONS
	getDayOfYearOfFirstWipe(date){
		if(!moment.isMoment(date)){
			console.error("Could not get time to next wipe, provided datetime is not a moment object..");
			return;
		}
		var copy_date = date.clone();
		var first_wipe_day_of_year;
		if(this.wipe_day !== null){
			var first_day_of_year = copy_date.dayOfYear(1).isoWeekday();
			// 6 < 1
			if(first_day_of_year > this.wipe_day){
				first_wipe_day_of_year = copy_date.dayOfYear(1).isoWeekday(first_day_of_year+7).isoWeekday(this.wipe_day).dayOfYear();
			}else{
				first_wipe_day_of_year = copy_date.dayOfYear(1).isoWeekday(this.wipe_day).dayOfYear();
			}
		}
		return first_wipe_day_of_year;
	}


	/**
	 * 
	 * @param {*} date 
	 */
	isTimeToWipe(date) {
		if(!moment.isMoment(date)){
			console.error("Could not get time to next wipe, provided datetime is not a moment object..");
			return;
		}
		var current_hour = date.hour();
		var current_minute = date.minute();
		// Hour is right
		if(current_hour == this.wipe_hour){
			// Check if minute is atleast past desired time
			if(current_minute >= this.wipe_minute){
				return true;
			}
		}
		return false;
	}


	isForceWeek(date){
		if(!moment.isMoment(date)){
			console.error("Could not get time to next wipe, provided datetime is not a moment object..");
			return;
		}
		// If we want to exclude force week
		if(this.exclude_force_week){
			const day_of_month = date.date();
			// If day of month is below 7 then always skip wipe
			if(day_of_month < 7){
				return true;
			}
		}
		return false
	}
}

module.exports = WipeScheduler;
