var assert = require('assert');
var expect = require('expect.js');
var WipeScheduler = require('../lib/WipeScheduler');
const fc = require('fast-check');
const moment = require('moment-timezone');
describe('WipeScheduler', function () {
	describe('time to wipe', function () {
		it('getTimeToNextWipe should always return ms time to next wipeday', function () {
			fc.assert(
				fc.property(
          			fc.date({ min: new Date("2000-01-01T00:00:00Z") }),
					fc.integer(1, 7),
					fc.boolean(),
					fc.integer(0, 23),
					fc.integer(0, 23),
					(
            			currentDay,
						wipeDay,
						exclude_force_week,
						wipe_hour,
						wipe_minute
					) => {
           				var currentTime = moment(currentDay.toISOString().split('.')[0]+"Z").utcOffset(2);
						//Skip invalid dates
						if (!currentTime.isValid()) return;
						const scheduler = new WipeScheduler(
							7,
							1,
							wipe_hour,
							wipe_minute,
							exclude_force_week,
							wipeDay
						);
						var timeToWipe = scheduler.getTimeToNextWipe(currentTime);
						expect(timeToWipe).to.above(-1);
						currentTime = currentTime.add(timeToWipe, 'ms');
						expect(currentTime.isoWeekday()).to.be.equal(wipeDay);
						var add_dst_hour = currentTime.isDST() && currentTime.isDSTShifted() ? 1 : 0;
						expect(currentTime.hour()).to.be.equal(wipe_hour + add_dst_hour);
						expect(currentTime.minute()).to.be.equal(wipe_minute);
						if(exclude_force_week){
							expect(currentTime.date()).to.be.above(6);
						}
					}
				),
				{
					numRuns: 10000,
				}
			);
		});
		it('getTimeToNextWipe should always return ms time to next wipeday - manual', function () {
			var [
        		current_day,
				wipe_day,
				exclude_force_week,
				wipe_hour,
				wipe_minute,
			] = [new Date("2000-01-01T00:00:00.000Z"),1,true,0,0];
      		var currentTime = moment(current_day.toISOString().split('.')[0]+"Z").utcOffset(2);

			//Skip invalid dates
			if (!currentTime.isValid()) return;
			const scheduler = new WipeScheduler(
				7,
				1,
				wipe_hour,
				wipe_minute,
				exclude_force_week,
				wipe_day
			);
			var timeToWipe = scheduler.getTimeToNextWipe(currentTime);
			expect(timeToWipe).to.be.above(-1);
			currentTime = currentTime.add(timeToWipe, 'ms');
			expect(currentTime.isoWeekday()).to.be.equal(wipe_day);
			var add_dst_hour = currentTime.isDST() ? 1 : 0;
			expect(currentTime.hour()).to.be.equal(wipe_hour + add_dst_hour);
			expect(currentTime.minute()).to.be.equal(wipe_minute);
			if(exclude_force_week){
				expect(currentTime.date()).to.be.above(6);
			}
		});
		it('getDayOfYearOfFirstWipe should always return first wipe day of year', function () {
			fc.assert(
				fc.property(fc.integer(1, 7), fc.integer(0, 999), (wipeDay, year) => {
					var currentTime = moment(
						'2' +
							(year < 100 ? '0' + (year < 10 ? '0' + year : year) : year) +
							'-01-01'
					);
					const scheduler = new WipeScheduler(7, 1, 17, 00, false, wipeDay);
					var first_wipe_day_of_year = scheduler.getDayOfYearOfFirstWipe(
						currentTime
					);
					expect(first_wipe_day_of_year).to.be.within(0, 13);
					currentTime.dayOfYear(first_wipe_day_of_year);
					expect(currentTime.isoWeekday()).to.be.equal(wipeDay);
				}),
				{
					numRuns: 10000,
				}
			);
		});
		it('getDayOfYearOfFirstWipe should always return first wipe day of year - manual', function () {
			var wipeDay = 1;
			var year = 0;
			var currentTime = moment(
        '2' + (year < 100 ? '0' + (year < 10 ? '0' + year : year) : year)
			);
			const scheduler = new WipeScheduler(7, 1, 17, 00, false, wipeDay);
			var first_wipe_day_of_year = scheduler.getDayOfYearOfFirstWipe(
				currentTime
			);
			expect(first_wipe_day_of_year).to.be.within(1, 13);
			currentTime.dayOfYear(first_wipe_day_of_year);
			expect(currentTime.isoWeekday()).to.be.equal(wipeDay);
		});

		
		it('Should allways return map wipe if its the date', function () {
			fc.assert(
				fc.property(
          			fc.date({ min: new Date("2000-01-01T00:00:00Z") }),
					fc.integer(1, 7),
					fc.boolean(),
					fc.integer(0, 23),
					fc.integer(0, 23),
					(
            			currentDay,
						wipeDay,
						exclude_force_week,
						wipe_hour,
						wipe_minute
					) => {
           				var currentTime = moment(currentDay.toISOString().split('.')[0]+"Z").utcOffset(2);
						//Skip invalid dates
						if (!currentTime.isValid()) return;
						const scheduler = new WipeScheduler(
							7,
							1,
							wipe_hour,
							wipe_minute,
							exclude_force_week,
							wipeDay
						);
						var shouldMapWipe = scheduler.shouldMapWipe(currentTime);


						
						currentTime = currentTime.add(timeToWipe, 'ms');
						expect(currentTime.isoWeekday()).to.be.equal(wipeDay);
						var add_dst_hour = currentTime.isDST() && currentTime.isDSTShifted() ? 1 : 0;
						expect(currentTime.hour()).to.be.equal(wipe_hour + add_dst_hour);
						expect(currentTime.minute()).to.be.equal(wipe_minute);
						if(exclude_force_week){
							expect(currentTime.date()).to.be.above(6);
						}
					}
				),
				{
					numRuns: 10000,
				}
			);
		});
	});
});
