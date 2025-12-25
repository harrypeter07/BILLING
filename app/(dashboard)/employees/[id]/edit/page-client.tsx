"use client"

import { useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { EmployeeForm } from "@/components/features/employees/employee-form"
import { useUserRole } from "@/lib/hooks/use-user-role"
import { useToast } from "@/hooks/use-toast"
import { useEmployee } from "@/lib/hooks/use-cached-data"

export default function EditEmployeePageClient() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { isAdmin, loading: roleLoading } = useUserRole()
  const { data: employee, isLoading, error } = useEmployee(params.id as string)

  useEffect(() => {
    if (!roleLoading && !isAdmin) {
      router.push("/employees")
      return
    }
  }, [isAdmin, roleLoading, router])

  useEffect(() => {
    if (error) {
      toast({ title: "Error", description: "Employee not found", variant: "destructive" })
      router.push("/employees")
    }
  }, [error, router, toast])

  if (roleLoading || isLoading) {
    return <div className="text-center py-8">Loading...</div>
  }

  if (!employee) {
    return <div className="text-center py-8">Employee not found</div>
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 md:p-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Edit Employee</h1>
        <p className="text-muted-foreground">Update employee information</p>
      </div>

      <EmployeeForm employee={employee} />
    </div>
  )
}






























