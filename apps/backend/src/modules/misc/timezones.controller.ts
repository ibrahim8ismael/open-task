import { Controller, Get } from "@nestjs/common";
import { Public } from "../../common/decorators/auth.decorators";

const TIMEZONES: Array<{ utc_offset: string; gmt_offset: string; label: string; value: string }> = [
  { utc_offset: "+00:00", gmt_offset: "(GMT +00:00)", label: "UTC", value: "UTC" },
  { utc_offset: "+01:00", gmt_offset: "(GMT +01:00)", label: "Europe/London", value: "Europe/London" },
  { utc_offset: "+02:00", gmt_offset: "(GMT +02:00)", label: "Europe/Athens", value: "Europe/Athens" },
  { utc_offset: "+03:00", gmt_offset: "(GMT +03:00)", label: "Europe/Moscow", value: "Europe/Moscow" },
  { utc_offset: "+04:00", gmt_offset: "(GMT +04:00)", label: "Asia/Dubai", value: "Asia/Dubai" },
  { utc_offset: "+05:30", gmt_offset: "(GMT +05:30)", label: "Asia/Kolkata", value: "Asia/Kolkata" },
  { utc_offset: "+07:00", gmt_offset: "(GMT +07:00)", label: "Asia/Bangkok", value: "Asia/Bangkok" },
  { utc_offset: "+08:00", gmt_offset: "(GMT +08:00)", label: "Asia/Singapore", value: "Asia/Singapore" },
  { utc_offset: "+09:00", gmt_offset: "(GMT +09:00)", label: "Asia/Tokyo", value: "Asia/Tokyo" },
  { utc_offset: "-05:00", gmt_offset: "(GMT -05:00)", label: "America/New_York", value: "America/New_York" },
  { utc_offset: "-06:00", gmt_offset: "(GMT -06:00)", label: "America/Chicago", value: "America/Chicago" },
  { utc_offset: "-07:00", gmt_offset: "(GMT -07:00)", label: "America/Denver", value: "America/Denver" },
  { utc_offset: "-08:00", gmt_offset: "(GMT -08:00)", label: "America/Los_Angeles", value: "America/Los_Angeles" },
];

@Public()
@Controller("api/timezones")
export class TimezonesController {
  @Get()
  list(): { timezones: Array<{ utc_offset: string; gmt_offset: string; label: string; value: string }> } {
    return { timezones: TIMEZONES };
  }
}
