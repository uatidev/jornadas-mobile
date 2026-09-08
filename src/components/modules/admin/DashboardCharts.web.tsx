import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface DashboardChartDatum {
  label: string;
  value: number;
}

const COLORS = ["#981646", "#c99b52", "#2563eb", "#16a34a", "#d97706", "#71717a"];

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid #e4e4e7",
  fontFamily: "Poppins, sans-serif",
};

export function StatusPieChart({ data }: { data: DashboardChartDatum[] }) {
  const values = data.filter((item) => item.value > 0);

  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <PieChart>
          <Pie
            data={values.length ? values : [{ label: "Sin datos", value: 1 }]}
            dataKey="value"
            nameKey="label"
            innerRadius={58}
            outerRadius={92}
            paddingAngle={3}
          >
            {(values.length ? values : [{ label: "Sin datos", value: 1 }]).map((item, index) => (
              <Cell key={item.label} fill={values.length ? COLORS[index % COLORS.length] : "#d4d4d8"} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${value}`, "Solicitudes"]} />
          <Legend iconType="circle" wrapperStyle={{ fontFamily: "Poppins, sans-serif", fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function RequestsBarChart({ data }: { data: DashboardChartDatum[] }) {
  return (
    <div style={{ width: "100%", height: 300 }}>
      <ResponsiveContainer>
        <BarChart data={data} margin={{ top: 8, right: 12, left: -18, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e4e4e7" />
          <XAxis dataKey="label" tick={{ fontFamily: "Poppins, sans-serif", fontSize: 11 }} angle={-12} textAnchor="end" height={58} />
          <YAxis allowDecimals={false} tick={{ fontFamily: "Poppins, sans-serif", fontSize: 11 }} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(152, 22, 70, 0.06)" }} />
          <Bar dataKey="value" name="Solicitudes" fill="#981646" radius={[8, 8, 0, 0]} maxBarSize={54} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
