"""Tests for scripts/bods_timetables.py. Run: python3 -m unittest scripts/test_bods_timetables.py"""
import datetime as dt
import json
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(__file__))
import bods_timetables as b  # noqa: E402

TXC = b"""<?xml version="1.0" encoding="UTF-8"?>
<TransXChange xmlns="http://www.transxchange.org.uk/">
  <StopPoints>
    <AnnotatedStopPointRef><StopPointRef>A</StopPointRef><CommonName>Depot</CommonName></AnnotatedStopPointRef>
    <AnnotatedStopPointRef><StopPointRef>B</StopPointRef><CommonName>  Village   Green </CommonName></AnnotatedStopPointRef>
    <AnnotatedStopPointRef><StopPointRef>C</StopPointRef><CommonName>Town</CommonName></AnnotatedStopPointRef>
  </StopPoints>
  <JourneyPatternSections>
    <JourneyPatternSection id="S1">
      <JourneyPatternTimingLink id="L1">
        <From><StopPointRef>A</StopPointRef></From>
        <To><StopPointRef>B</StopPointRef></To>
        <RunTime>PT5M</RunTime>
      </JourneyPatternTimingLink>
      <JourneyPatternTimingLink id="L2">
        <From><WaitTime>PT1M</WaitTime><StopPointRef>B</StopPointRef></From>
        <To><StopPointRef>C</StopPointRef></To>
        <RunTime>PT10M</RunTime>
      </JourneyPatternTimingLink>
    </JourneyPatternSection>
  </JourneyPatternSections>
  <Services>
    <Service>
      <ServiceCode>SVC1</ServiceCode>
      <Lines><Line id="LN1"><LineName>1</LineName></Line></Lines>
      <OperatingPeriod><StartDate>2026-01-01</StartDate><EndDate>2027-12-31</EndDate></OperatingPeriod>
      <OperatingProfile><RegularDayType><DaysOfWeek><MondayToFriday/></DaysOfWeek></RegularDayType></OperatingProfile>
      <StandardService>
        <Origin>Depot</Origin><Destination>Town</Destination>
        <JourneyPattern id="JP1"><DestinationDisplay>Stratford</DestinationDisplay><JourneyPatternSectionRefs>S1</JourneyPatternSectionRefs></JourneyPattern>
      </StandardService>
    </Service>
  </Services>
  <VehicleJourneys>
    <VehicleJourney>
      <VehicleJourneyCode>VJ1</VehicleJourneyCode><ServiceRef>SVC1</ServiceRef><LineRef>LN1</LineRef>
      <JourneyPatternRef>JP1</JourneyPatternRef><DepartureTime>07:00:00</DepartureTime>
      <OperatingProfile>
        <RegularDayType><DaysOfWeek><MondayToFriday/></DaysOfWeek></RegularDayType>
        <BankHolidayOperation><DaysOfNonOperation><AllBankHolidays/></DaysOfNonOperation></BankHolidayOperation>
      </OperatingProfile>
    </VehicleJourney>
    <VehicleJourney>
      <VehicleJourneyCode>VJ2</VehicleJourneyCode><ServiceRef>SVC1</ServiceRef><LineRef>LN1</LineRef>
      <JourneyPatternRef>JP1</JourneyPatternRef><DepartureTime>09:30:00</DepartureTime>
      <OperatingProfile><RegularDayType><DaysOfWeek><Saturday/></DaysOfWeek></RegularDayType></OperatingProfile>
      <VehicleJourneyTimingLink><JourneyPatternTimingLinkRef>L1</JourneyPatternTimingLinkRef><RunTime>PT8M</RunTime></VehicleJourneyTimingLink>
    </VehicleJourney>
    <VehicleJourney>
      <VehicleJourneyCode>VJ3</VehicleJourneyCode><ServiceRef>SVC1</ServiceRef><LineRef>LN1</LineRef>
      <JourneyPatternRef>JP1</JourneyPatternRef><DepartureTime>08:15:00</DepartureTime>
      <OperatingProfile>
        <RegularDayType><DaysOfWeek><MondayToFriday/></DaysOfWeek></RegularDayType>
        <ServicedOrganisationDayType><DaysOfOperation><WorkingDays><ServicedOrganisationRef>SCH</ServicedOrganisationRef></WorkingDays></DaysOfOperation></ServicedOrganisationDayType>
      </OperatingProfile>
    </VehicleJourney>
    <VehicleJourney>
      <VehicleJourneyCode>VJ4</VehicleJourneyCode><ServiceRef>SVC1</ServiceRef><LineRef>LN1</LineRef>
      <VehicleJourneyRef>VJ1</VehicleJourneyRef><DepartureTime>23:58:00</DepartureTime>
    </VehicleJourney>
  </VehicleJourneys>
</TransXChange>
"""

HOLIDAYS = json.dumps({"england-and-wales": {"events": [
    {"title": "Christmas Day", "date": "2026-12-25"},
    {"title": "Boxing Day", "date": "2026-12-28"},
]}}).encode()


def run(dates, wanted=("B",)):
    table = b.bank_holiday_names(lambda url: HOLIDAYS)
    rows = list(b.departures_in_txc(TXC, set(wanted), dates, table))
    names = rows.pop()[1]
    return rows, names


class Timetables(unittest.TestCase):
    def test_durations(self):
        self.assertEqual(b.seconds("PT1H2M30S"), 3750)
        self.assertEqual(b.seconds("PT0S"), 0)
        self.assertEqual(b.seconds(None), 0)

    def test_weekday_departure_includes_run_and_wait(self):
        thu = dt.date(2026, 11, 26)
        rows, names = run([thu])
        # 07:00 + 5 min to B + 1 min wait = 07:06. The 08:15 school bus is left out,
        # and the 23:58 journey leaves B after midnight, so it's left out too.
        self.assertEqual(rows, [(thu, "B", "1", "Stratford", "07:06")])
        self.assertEqual(names, {"B": "Village Green"})

    def test_saturday_uses_the_journeys_own_run_time(self):
        sat = dt.date(2026, 11, 28)
        rows, _ = run([sat])
        self.assertEqual([r[4] for r in rows], ["09:39"])

    def test_bank_holidays_and_substitute_days(self):
        rows, _ = run([dt.date(2026, 12, 25), dt.date(2026, 12, 28)])
        self.assertEqual(rows, [])
        table = b.bank_holiday_names(lambda url: HOLIDAYS)
        self.assertIn("BoxingDayHoliday", table[dt.date(2026, 12, 28)])

    def test_last_stop_is_not_a_departure(self):
        rows, _ = run([dt.date(2026, 11, 26)], wanted=("C",))
        self.assertEqual(rows, [])

    def test_outside_operating_period(self):
        rows, _ = run([dt.date(2028, 1, 4)])
        self.assertEqual(rows, [])


if __name__ == "__main__":
    unittest.main()
