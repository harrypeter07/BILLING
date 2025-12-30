"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Edit2, Trash2, Key, Eye } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useUserRole } from "@/lib/hooks/use-user-role"
import { db } from "@/lib/dexie-client"
import { getDatabaseType } from "@/lib/utils/db-mode"
import { storageManager } from "@/lib/storage-manager"
import { useEmployees, useInvalidateQueries } from "@/lib/hooks/use-cached-data"

interface Employee {
  id: string
  name: string
  email: string
  phone: string
  role: string
  salary: number
  joining_date: string
  is_active: boolean
}

export default function EmployeesPage() {
  const { data: employees = [], isLoading } = useEmployees()
  const { invalidateEmployees } = useInvalidateQueries()
  const [searchTerm, setSearchTerm] = useState("")
  const { toast } = useToast()
  const { isAdmin, isEmployee, isLoading: roleLoading } = useUserRole()
  const router = useRouter()

  useEffect(() => {
    // Wait for role to be determined
    if (roleLoading) {
      return
    }

    // Only admin can access this page
    if (isEmployee || !isAdmin) {
      router.push("/dashboard")
      return
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, isAdmin, isEmployee, roleLoading])

  // Listen for refresh events
  useEffect(() => {
    const handleRefresh = () => {
      console.log("[Employees] Refresh event received, invalidating employees cache...")
      invalidateEmployees()
    }

    window.addEventListener('employees:refresh', handleRefresh)
    return () => {
      window.removeEventListener('employees:refresh', handleRefresh)
    }
  }, [invalidateEmployees])

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure?")) return
    try {
      const supabase = createClient()
      await supabase.from("employees").delete().eq("id", id)
      invalidateEmployees() // Invalidate cache to refetch
      toast({
        title: "Success",
        description: "Employee deleted",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete employee",
        variant: "destructive",
      })
    }
  }

  const filteredEmployees = employees.filter(
    (emp) =>
      emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Employees</h1>
          <p className="text-sm md:text-base text-muted-foreground">Manage your team members</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <Button asChild className="text-xs sm:text-sm">
              <Link href="/employees/new">
                <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Add Employee</span>
                <span className="sm:hidden">Add</span>
              </Link>
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <Input
              placeholder="Search employees..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-0 text-sm md:text-base"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 sm:p-4 md:p-6">
          {isLoading ? (
            <div className="text-center py-8">Loading...</div>
          ) : filteredEmployees.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">No employees found</div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="block md:hidden space-y-4 p-4">
                {filteredEmployees.map((emp: any) => (
                  <Card key={emp.id} className="border">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base truncate">{emp.name}</h3>
                          <p className="text-sm text-muted-foreground truncate">{emp.email}</p>
                        </div>
                        <Badge variant={emp.is_active ? "default" : "secondary"} className="ml-2 flex-shrink-0">
                          {emp.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">ID:</span>
                          <span className="ml-1 font-mono">{emp.employee_id || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Role:</span>
                          <span className="ml-1 capitalize">{emp.role}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Phone:</span>
                          <span className="ml-1">{emp.phone || "N/A"}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Salary:</span>
                          <span className="ml-1">₹{emp.salary?.toLocaleString() || "N/A"}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-muted-foreground">Store:</span>
                          <span className="ml-1 text-sm">
                            {emp.stores ? (
                              <>
                                {emp.stores.name} <span className="text-muted-foreground font-mono">({emp.stores.store_code})</span>
                              </>
                            ) : (
                              "N/A"
                            )}
                          </span>
                        </div>
                        {emp.password && (
                          <div className="col-span-2">
                            <span className="text-muted-foreground">Password:</span>
                            <span className="ml-1 font-mono text-xs">{emp.password}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button variant="ghost" size="sm" asChild className="flex-1">
                          <Link href={`/employees/${emp.id}`}>
                            <Eye className="mr-1 h-3 w-3" />
                            View
                          </Link>
                        </Button>
                        <Button variant="ghost" size="sm" asChild className="flex-1">
                          <Link href={`/employees/${emp.id}/edit`}>
                            <Edit2 className="mr-1 h-3 w-3" />
                            Edit
                          </Link>
                        </Button>
                        {isAdmin && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={async () => {
                                if (!confirm(`Reset password for ${emp.name}?`)) return
                                try {
                                  const newPassword = emp.employee_id || emp.id.slice(0, 4).toUpperCase()
                                  invalidateEmployees()
                                } catch (error: any) {
                                  toast({ title: "Error", description: error.message || "Failed to reset password", variant: "destructive" })
                                }
                              }}
                              className="px-2"
                              title="Reset Password"
                            >
                              <Key className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(emp.id)}
                              className="px-2 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto -mx-6 px-6">
                <div className="min-w-[1200px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[100px]">Employee ID</TableHead>
                        <TableHead className="min-w-[150px]">Name</TableHead>
                        <TableHead className="min-w-[180px]">Email</TableHead>
                        <TableHead className="min-w-[120px]">Phone</TableHead>
                        <TableHead className="min-w-[100px]">Password</TableHead>
                        <TableHead className="min-w-[150px]">Store</TableHead>
                        <TableHead className="min-w-[80px]">Role</TableHead>
                        <TableHead className="min-w-[100px]">Salary</TableHead>
                        <TableHead className="min-w-[120px]">Joining Date</TableHead>
                        <TableHead className="min-w-[80px]">Status</TableHead>
                        <TableHead className="min-w-[180px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredEmployees.map((emp: any) => (
                        <TableRow key={emp.id}>
                          <TableCell className="font-mono font-medium">{emp.employee_id || "N/A"}</TableCell>
                          <TableCell className="font-medium">{emp.name}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{emp.email}</TableCell>
                          <TableCell>{emp.phone}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {emp.password ? (
                              <span title={emp.password} className="max-w-[100px] truncate block">{emp.password}</span>
                            ) : (
                              <span className="text-muted-foreground">{emp.employee_id || "N/A"}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {emp.stores ? (
                              <span className="text-sm">
                                {emp.stores.name} <span className="text-muted-foreground font-mono">({emp.stores.store_code})</span>
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-sm">N/A</span>
                            )}
                          </TableCell>
                          <TableCell className="capitalize">{emp.role}</TableCell>
                          <TableCell>₹{emp.salary?.toLocaleString() || "N/A"}</TableCell>
                          <TableCell>{emp.joining_date ? new Date(emp.joining_date).toLocaleDateString() : "N/A"}</TableCell>
                          <TableCell>
                            <Badge variant={emp.is_active ? "default" : "secondary"}>
                              {emp.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-2">
                              <Button variant="ghost" size="icon" asChild title="View Details">
                                <Link href={`/employees/${emp.id}`}>
                                  <Eye className="h-4 w-4" />
                                </Link>
                              </Button>
                              <Button variant="ghost" size="icon" asChild title="Edit">
                                <Link href={`/employees/${emp.id}/edit`}>
                                  <Edit2 className="h-4 w-4" />
                                </Link>
                              </Button>
                              {isAdmin && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={async () => {
                                    if (!confirm(`Reset password for ${emp.name} to ${emp.employee_id || emp.id.slice(0, 4).toUpperCase()}?`)) return
                                    try {
                                      const newPassword = emp.employee_id || emp.id.slice(0, 4).toUpperCase()
                                      const supabase = createClient()
                                      await supabase.from("employees").update({ password: newPassword }).eq("id", emp.id)
                                      toast({ title: "Success", description: `Password reset to ${newPassword}` })
                                      invalidateEmployees()
                                    } catch (error: any) {
                                      toast({ title: "Error", description: error.message || "Failed to reset password", variant: "destructive" })
                                    }
                                  }}
                                  title="Reset Password"
                                >
                                  <Key className="h-4 w-4" />
                                </Button>
                              )}
                              {isAdmin && (
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(emp.id)} title="Delete">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
